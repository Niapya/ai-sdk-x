import type { Command } from "just-bash";
import { createAddMemoryCommand } from "@/commands/memory/add";
import { createListMemoryCommand } from "@/commands/memory/list";
import { createSearchMemoryCommand } from "@/commands/memory/search";
import type { MemoryCommandOptions } from "@/commands/memory/types";
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

export type { MemoryCommandOptions } from "@/commands/memory/types";
