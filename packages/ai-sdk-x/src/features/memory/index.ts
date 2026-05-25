import type { Command } from "just-bash";
import { createAddMemoryCommand } from "@/features/memory/add";
import { createListMemoryCommand } from "@/features/memory/list";
import { createSearchMemoryCommand } from "@/features/memory/search";
import type { MemoryCommandOptions, MemoryConfig, MemoryOptions } from "@/features/memory/types";
import type { FeatureSetupContext, FeatureSetupResult } from "@/features/shared";
import {
	mountConfiguredFeature,
	resolveFeatureOption,
	resolveMountedFeatureConfig,
} from "@/features/shared";
import { DEFAULT_MEMORY_MOUNT } from "@/runtime/constants";
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

export function setupMemoryFeature(
	context: FeatureSetupContext,
	option: boolean | MemoryOptions | undefined,
): FeatureSetupResult<MemoryConfig> {
	const resolvedOption = resolveFeatureOption(option);
	const config: MemoryConfig = {
		...resolveMountedFeatureConfig(option, DEFAULT_MEMORY_MOUNT),
		cache: resolvedOption?.cache,
	};

	return {
		command: config.enabled
			? createMemoryCommand({
					cache: config.cache,
					mountPoint: config.mountPoint,
				})
			: undefined,
		config,
		initPaths: mountConfiguredFeature(context, config, DEFAULT_MEMORY_MOUNT),
	};
}

export type { MemoryCommandOptions, MemoryConfig, MemoryOptions } from "@/features/memory/types";
