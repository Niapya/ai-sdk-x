import type { Command, CommandContext, IFileSystem } from "just-bash";
import { type AddMemoryInput, addMemory, createAddMemoryCommand } from "@/features/memory/add";
import { createDeleteMemoryCommand, deleteMemory } from "@/features/memory/delete";
import { createFindMemoryCommand, findMemory } from "@/features/memory/find";
import { createListMemoryCommand, listMemory } from "@/features/memory/list";
import type { MemoryCommandOptions, MemoryConfig, MemoryOptions } from "@/features/memory/types";
import { createUpdateMemoryCommand, updateMemory } from "@/features/memory/update";
import { initMemoryIndex } from "@/features/memory/utils/lockfile";
import { AsyncOnce } from "@/runtime/async-once";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type { ExecHookStartContext, Feature } from "@/types";
import { type CliTopicDefinition, createCommand } from "@/utils/command";

export const DEFAULT_MEMORY_MOUNT = "/home/user/memory";

export function createMemoryFeatureDescription(mountPoint: string): string {
	return [
		`Persistent memory mount($MEMORY_HOME): ${mountPoint}.`,
		"Memory provides persistent storage and retrieval of user preferences, project context, and key facts to maintain continuity and personalization across sessions.",
		"When you need to look up past facts, user preferences, or any cross-session persistent information, consult Memory first.",
		"Check these core files when relevant:",
		"- `$MEMORY_HOME/AGENT.md` for Agent-side notes: AI execution strategies, known limitations, and working preferences",
		"- `$MEMORY_HOME/USER.md` for User-side notes: user preferences, project conventions, and personal style",
		"- `$MEMORY_HOME/MEMORY.md` for Shared context: general knowledge maintained by both sides",
		"Daily memory works like a diary. When a task or key decision is completed, proactively write an entry recording what was done, what was decided, and what matters for the future. It is stored under $MEMORY_HOME/ daily/YYYY-MM-DD/title.md , organized by date and title。",
		"`x-memory` commands are Bash commands. Use `x-memory list` and `x-memory find` to discover memory. Use `x-memory add`, `x-memory update`, and `x-memory delete` update memory",
		"DO NOT add, update, or delete memory entries DIRECTLY with shell file writes — because the lockfile would not be maintained. Always USE the `x-memory` command INSTEAD.",
	].join("\n");
}

const MEMORY_COMMAND = {
	id: "x-memory",
	type: "topic",
	summary: "Manage mounted long-term and daily memory.",
	usage: "x-memory <add|delete|list|find|update> [args]",
	description: [
		"Stores durable memory body files plus searchable metadata in memory.json.",
		"Memory layers: AGENT.md for agent-side notes, USER.md for user-side notes, MEMORY.md for shared context, and daily/YYYY-MM-DD/title.md for daily memories.",
		"Use x-memory CLI to add, update, and delete memory so memory.json stays in sync; do not mutate memory files directly with shell writes except when only reading file paths returned by list/find.",
		"Only daily categorized memories are supported for now.",
	],
	examples: [
		{ command: "x-memory list" },
		{
			command:
				"printf 'note' | x-memory add note-title --description 'Short summary' --keyword project --stdin",
		},
		{ command: "x-memory find important" },
		{ command: "printf 'agent note' | x-memory update AGENT.md --stdin" },
	],
	hidden: false,
} satisfies Omit<CliTopicDefinition, "subcommands">;

export function createMemoryCommand(options: MemoryCommandOptions): Command {
	const addCommand = createAddMemoryCommand(options);
	return createCommand({
		...MEMORY_COMMAND,
		subcommands: [
			addCommand,
			createListMemoryCommand(options),
			createFindMemoryCommand(options),
			createUpdateMemoryCommand(options),
			createDeleteMemoryCommand(options),
		],
	});
}

export type MemoryFeature = Feature & {
	readonly add?: (input: AddMemoryInput, ctx: CommandContext) => ReturnType<typeof addMemory>;
	readonly createCommand?: () => Command;
	readonly delete?: (
		input: Parameters<typeof deleteMemory>[0],
		ctx: CommandContext,
	) => ReturnType<typeof deleteMemory>;
	readonly find?: (
		input: Parameters<typeof findMemory>[0],
		fs: IFileSystem,
	) => ReturnType<typeof findMemory>;
	readonly list?: (fs: IFileSystem) => ReturnType<typeof listMemory>;
	readonly update?: (
		input: Parameters<typeof updateMemory>[0],
		ctx: CommandContext,
	) => ReturnType<typeof updateMemory>;
};

export function createMemoryFeature(
	option: boolean | MemoryOptions | undefined = true,
): MemoryFeature {
	const resolvedOption = typeof option === "object" ? option : undefined;
	const config: MemoryConfig = {
		enabled: option !== false,
		fs: resolvedOption?.fs,
		mountPoint: resolvedOption?.mountPoint ?? DEFAULT_MEMORY_MOUNT,
	};

	if (!config.enabled) {
		return {
			name: "memory",
		};
	}

	const commandOptions: MemoryCommandOptions = {
		mountPoint: config.mountPoint,
	};
	const createMainCommand = () => createMemoryCommand(commandOptions);

	const initialize = new AsyncOnce<[ExecHookStartContext]>(async (context) => {
		if (config.fs) {
			context.fs.mount(config.mountPoint, config.fs);
		} else {
			if (config.mountPoint !== DEFAULT_MEMORY_MOUNT) {
				context.fs.mount(config.mountPoint, createSubpathFs(context.fs, DEFAULT_MEMORY_MOUNT));
			}

			await context.fs.mkdir(DEFAULT_MEMORY_MOUNT, { recursive: true });
		}

		await initMemoryIndex(context.fs, config.mountPoint);
		context.setEnv("MEMORY_HOME", config.mountPoint);
	});

	return {
		name: "memory",
		description: () => createMemoryFeatureDescription(config.mountPoint),
		command: [createMainCommand()],
		hooks: {
			onExecStart: (context) => initialize.run(context),
		},
		createCommand: createMainCommand,
		add: (input, ctx) => addMemory(input, ctx, commandOptions),
		delete: (input, ctx) => deleteMemory(input, ctx, commandOptions),
		find: (input, fs) => findMemory(input, fs, commandOptions),
		list: (fs) => listMemory(fs, commandOptions),
		update: (input, ctx) => updateMemory(input, ctx, commandOptions),
	};
}

export type { MemoryCommandOptions, MemoryConfig, MemoryOptions } from "@/features/memory/types";
