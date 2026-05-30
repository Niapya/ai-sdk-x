import type { Command, CommandContext, IFileSystem } from "just-bash";
import { type AddMemoryInput, addMemory, createAddMemoryCommand } from "@/features/memory/add";
import { createDeleteMemoryCommand, deleteMemory } from "@/features/memory/delete";
import { createGetMemoryCommand, getMemory } from "@/features/memory/get";
import { createInitMemoryCommand, initMemory } from "@/features/memory/init";
import { createListMemoryCommand, listMemory } from "@/features/memory/list";
import { createSearchMemoryCommand, searchMemory } from "@/features/memory/search";
import { createStatusMemoryCommand, statusMemory } from "@/features/memory/status";
import type { MemoryCommandOptions, MemoryConfig, MemoryOptions } from "@/features/memory/types";
import { createUpdateMemoryCommand, updateMemory } from "@/features/memory/update";
import { AsyncOnce } from "@/runtime/async-once";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type { ExecHookStartContext, Feature } from "@/types";
import { type CliTopicDefinition, createCommand } from "@/utils/command";

export const DEFAULT_MEMORY_MOUNT = "/home/user/memory";

export function createMemoryFeatureDescription(mountPoint: string): string {
	return [
		`The memory feature provides persistent agent context storage at ${mountPoint}.`,
		"Memory is where durable context for future agent runs belongs: agent-side notes in AGENT.md, user-side notes in USER.md, shared context in MEMORY.md, plus categorized entries such as daily, project, and topic notes.",
		'Use `x-memory` through the bash tool, not as a separate callable tool. Put the shell command in command, for example command="x-memory search project", command="x-memory add --category project --stdin note-title" with stdin="note body", command="x-memory add --category project --file ./notes.md note-title", or command="x-memory core get agent".',
		"Use --category to organize entries. Do not use --layer.",
		"`x-memory add`, `x-memory update`, and `x-memory core update` accept --stdin or --file. They store body files under MEMORY_HOME and index searchable metadata in memory.json.",
		"`x-memory search` searches only category, title, description, and keywords. Do not grep MEMORY_HOME for full-text search unless the user explicitly asks; use the CLI to avoid expensive I/O.",
		"Run x-memory --help or x-memory <subcommand> --help when unsure. Use memory only for information that should survive across future sessions.",
	].join("\n");
}

const MEMORY_COMMAND = {
	id: "x-memory",
	type: "topic",
	summary: "Manage mounted long-term and daily memory.",
	usage: "x-memory <init|add|note|search|get|update|delete|status|core> [args]",
	description: [
		"Stores durable memory body files plus searchable metadata in memory.json.",
		"Use --category to organize entries. Add or update bodies from stdin or --file.",
	],
	examples: [
		{ command: "x-memory init" },
		{ command: "printf 'note' | x-memory add --category daily --stdin note-title" },
		{ command: "x-memory core get agent" },
		{ command: "x-memory search important" },
	],
	hidden: false,
} satisfies Omit<CliTopicDefinition, "subcommands">;

export function createMemoryCommand(options: MemoryCommandOptions): Command {
	const addCommand = createAddMemoryCommand(options);
	return createCommand({
		...MEMORY_COMMAND,
		subcommands: [
			createInitMemoryCommand(options),
			addCommand,
			{ ...addCommand, aliases: [], id: "note" },
			createListMemoryCommand(options),
			createSearchMemoryCommand(options),
			createGetMemoryCommand(options),
			createUpdateMemoryCommand(options),
			createDeleteMemoryCommand(options),
			createStatusMemoryCommand(options),
		],
	});
}

export type MemoryFeature = Feature & {
	readonly add?: (input: AddMemoryInput, ctx: CommandContext) => ReturnType<typeof addMemory>;
	readonly createCommand?: () => Command;
	readonly delete?: (ref: string, ctx: CommandContext) => ReturnType<typeof deleteMemory>;
	readonly get?: (ref: string, fs: IFileSystem) => ReturnType<typeof getMemory>;
	readonly init?: (ctx: CommandContext) => ReturnType<typeof initMemory>;
	readonly list?: (fs: IFileSystem) => ReturnType<typeof listMemory>;
	readonly search?: (query: string, fs: IFileSystem) => ReturnType<typeof searchMemory>;
	readonly status?: (fs: IFileSystem) => ReturnType<typeof statusMemory>;
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
		delete: (ref, ctx) => deleteMemory(ref, ctx, commandOptions),
		get: (ref, fs) => getMemory(ref, fs, commandOptions),
		init: (ctx) => initMemory(ctx, commandOptions),
		list: (fs) => listMemory(fs, commandOptions),
		search: (query, fs) => searchMemory(query, fs, commandOptions),
		status: (fs) => statusMemory(fs, commandOptions),
		update: (input, ctx) => updateMemory(input, ctx, commandOptions),
	};
}

export type { MemoryCommandOptions, MemoryConfig, MemoryOptions } from "@/features/memory/types";
