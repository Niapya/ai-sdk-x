import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import {
	listDailyMemoryEntries,
	MEMORY_CORE_FILES,
	readMemoryIndex,
} from "@/features/memory/utils/lockfile";
import { renderMemoryTree, validateDailyCategory } from "@/features/memory/utils/output";
import { type CliCommandDefinition, defineCliCommand } from "@/utils/command";

export async function listMemory(
	fs: IFileSystem,
	options: MemoryCommandOptions,
	input: { category?: string } = {},
): Promise<ExecResult> {
	const category = validateDailyCategory(input.category, "x-memory list");
	if ("error" in category) {
		return category.error;
	}

	const index = await readMemoryIndex(fs, options.mountPoint);
	const entries = listDailyMemoryEntries(index);
	const stdout = `${renderMemoryTree({
		coreFiles: Object.values(MEMORY_CORE_FILES).map((filename) =>
			fs.resolvePath(options.mountPoint, filename),
		),
		dailyEntries: entries,
		memoryHome: options.mountPoint,
	})}\n`;
	return { stdout, stderr: "", exitCode: 0 };
}

export function createListMemoryCommand(options: MemoryCommandOptions): CliCommandDefinition<
	undefined,
	{
		category: {
			description: "Only list entries in this category. Only daily is supported for now.";
			type: "string";
		};
	}
> {
	return defineCliCommand({
		id: "list",
		type: "command",
		summary: "List stored memory files.",
		description: [
			"Lists core memory files and daily entries as a tree.",
			"View specific memory files with shell commands by using the returned file path.",
		],
		usage: "x-memory list [--category <category>]",
		flags: {
			category: {
				description: "Only list entries in this category. Only daily is supported for now.",
				type: "string",
			},
		} as const,
		run: ({ flags: { category } }, ctx) => listMemory(ctx.fs, options, { category }),
	});
}
