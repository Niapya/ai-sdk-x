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
	return `The memory feature provides persistent agent context storage at ${mountPoint}. Use x-memory through the bash tool, not as a separate callable tool. Put the shell command in command, for example command="x-memory search project" or command="x-memory add note-title" with stdin="note body". Run x-memory --help or x-memory <subcommand> --help when unsure. Use memory only for information that should survive across future sessions.`;
}

const MEMORY_COMMAND = {
	id: "x-memory",
	type: "topic",
	summary: "Manage mounted long-term and daily memory.",
	usage: "x-memory <init|add|note|search|get|update|delete|status> [args]",
	description: [
		"Stores daily memory metadata in memory.json.",
		"Use stdin as the memory description when adding or updating entries.",
	],
	examples: [
		{ command: "x-memory init" },
		{ command: "printf 'note' | x-memory add note-title" },
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
	readonly add: (input: AddMemoryInput, ctx: CommandContext) => ReturnType<typeof addMemory>;
	readonly createCommand: () => Command;
	readonly delete: (ref: string, ctx: CommandContext) => ReturnType<typeof deleteMemory>;
	readonly get: (ref: string, fs: IFileSystem) => ReturnType<typeof getMemory>;
	readonly init: (ctx: CommandContext) => ReturnType<typeof initMemory>;
	readonly list: (fs: IFileSystem) => ReturnType<typeof listMemory>;
	readonly search: (query: string, fs: IFileSystem) => ReturnType<typeof searchMemory>;
	readonly status: (fs: IFileSystem) => ReturnType<typeof statusMemory>;
	readonly update: (
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
	const commandOptions: MemoryCommandOptions = {
		mountPoint: config.mountPoint,
	};
	const feature: MemoryFeature = {
		name: "memory",
		createCommand: () => createMemoryCommand(commandOptions),
		add: (input, ctx) => addMemory(input, ctx, commandOptions),
		delete: (ref, ctx) => deleteMemory(ref, ctx, commandOptions),
		get: (ref, fs) => getMemory(ref, fs, commandOptions),
		init: (ctx) => initMemory(ctx, commandOptions),
		list: (fs) => listMemory(fs, commandOptions),
		search: (query, fs) => searchMemory(query, fs, commandOptions),
		status: (fs) => statusMemory(fs, commandOptions),
		update: (input, ctx) => updateMemory(input, ctx, commandOptions),
	};

	if (!config.enabled) {
		return feature;
	}

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
		...feature,
		description: () => createMemoryFeatureDescription(config.mountPoint),
		command: [feature.createCommand()],
		hooks: {
			onExecStart: (context) => initialize.run(context),
		},
	};
}

export type { MemoryCommandOptions, MemoryConfig, MemoryOptions } from "@/features/memory/types";
