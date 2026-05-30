import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import {
	formatMemoryEntry,
	listMemoryEntries,
	readMemoryIndex,
} from "@/features/memory/utils/lockfile";
import { type CliCommandDefinition, defineCliCommand } from "@/utils/command";

export async function listMemory(
	fs: IFileSystem,
	options: MemoryCommandOptions,
	input: { category?: string } = {},
): Promise<ExecResult> {
	const index = await readMemoryIndex(fs, options.mountPoint);
	const entries = listMemoryEntries(index)
		.filter((entry) => !input.category || entry.category === input.category)
		.map(formatMemoryEntry);
	const stdout = entries.length > 0 ? `${entries.join("\n")}\n` : "";
	return { stdout, stderr: "", exitCode: 0 };
}

export function createListMemoryCommand(options: MemoryCommandOptions): CliCommandDefinition<
	undefined,
	{
		category: {
			description: "Only list entries in this category.";
			type: "string";
		};
	}
> {
	return defineCliCommand({
		id: "list",
		type: "command",
		summary: "List stored memory files.",
		usage: "x-memory list [--category <category>]",
		flags: {
			category: {
				description: "Only list entries in this category.",
				type: "string",
			},
		} as const,
		run: ({ flags: { category } }, ctx) => listMemory(ctx.fs, options, { category }),
	});
}
