import type { Command, CommandContext, IFileSystem } from "just-bash";
import { type AddMemoryInput, addMemory, createAddMemoryCommand } from "@/features/memory/add";
import { createListMemoryCommand, listMemory } from "@/features/memory/list";
import { createSearchMemoryCommand, searchMemory } from "@/features/memory/search";
import type { MemoryCommandOptions, MemoryConfig, MemoryOptions } from "@/features/memory/types";
import { DEFAULT_MEMORY_MOUNT } from "@/runtime/constants";
import {
	initializeMountedFeature,
	resolveFeatureOption,
	resolveMountedFeatureConfig,
} from "@/runtime/features";
import type { Feature } from "@/types";
import { type CliTopicDefinition, createCommand } from "@/utils/command";

const MEMORY_COMMAND = {
	id: "x-memory",
	type: "topic",
	summary: "Manage mounted long-term and daily memory.",
	usage: "x-memory <list|add|search> [args]",
	description: [
		"Stores long-term memory in MEMORY.md and daily memory in daily/YYYY-MM-DD/*.md.",
		"Use stdin as the memory body when adding entries.",
	],
	examples: [
		{ command: "x-memory list" },
		{ command: "printf 'note' | x-memory add note-title" },
		{ command: "printf 'important' | x-memory add --long-term note-title" },
		{ command: "x-memory search important" },
	],
	hidden: false,
} satisfies Omit<CliTopicDefinition, "subcommands">;

export function createMemoryCommand(options: MemoryCommandOptions): Command {
	return createCommand({
		...MEMORY_COMMAND,
		subcommands: [
			createAddMemoryCommand(options),
			createListMemoryCommand(options),
			createSearchMemoryCommand(options),
		],
	});
}

export type MemoryFeature = Feature & {
	readonly add: (input: AddMemoryInput, ctx: CommandContext) => ReturnType<typeof addMemory>;
	readonly createCommand: () => Command;
	readonly list: (fs: IFileSystem) => ReturnType<typeof listMemory>;
	readonly search: (query: string, fs: IFileSystem) => ReturnType<typeof searchMemory>;
};

export function createMemoryFeature(
	option: boolean | MemoryOptions | undefined = true,
): MemoryFeature {
	const resolvedOption = resolveFeatureOption(option);
	const config: MemoryConfig = {
		...resolveMountedFeatureConfig(option, DEFAULT_MEMORY_MOUNT),
		cache: resolvedOption?.cache,
	};
	const commandOptions: MemoryCommandOptions = {
		cache: config.cache,
		mountPoint: config.mountPoint,
	};
	const feature: MemoryFeature = {
		name: "memory",
		createCommand: () => createMemoryCommand(commandOptions),
		add: (input, ctx) => addMemory(input, ctx, commandOptions),
		list: (fs) => listMemory(fs, commandOptions),
		search: (query, fs) => searchMemory(query, fs, commandOptions),
	};

	if (!config.enabled) {
		return feature;
	}

	return {
		...feature,
		prompt: () =>
			`Memory mount: ${config.mountPoint}. Use x-memory to store and search mounted memory notes.`,
		command: [feature.createCommand()],
		env: {
			MEMORY_HOME: config.mountPoint,
		},
		init: async (context) => {
			await initializeMountedFeature(context, config, DEFAULT_MEMORY_MOUNT);
		},
	};
}

export type { MemoryCommandOptions, MemoryConfig, MemoryOptions } from "@/features/memory/types";
