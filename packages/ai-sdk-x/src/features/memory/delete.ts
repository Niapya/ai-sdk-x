import type { CommandContext, ExecResult } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import {
	deleteMemoryEntry,
	getMemoryEntry,
	isMemoryCoreFileName,
	resolveMemoryHomePath,
} from "@/features/memory/utils/lockfile";
import { validateDailyCategory } from "@/features/memory/utils/output";
import { commandError, defineCliCommand } from "@/utils/command";

export async function deleteMemory(
	input: { category?: string; title: string },
	ctx: CommandContext,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const title = input.title.trim();
	if (!title) {
		return commandError("x-memory delete: missing <title>\n", 1);
	}
	if (isMemoryCoreFileName(title)) {
		return commandError(`x-memory delete: cannot delete core memory file: ${title}\n`, 1);
	}

	const category = validateDailyCategory(input.category, "x-memory delete");
	if ("error" in category) {
		return category.error;
	}

	const current = await getMemoryEntry(ctx.fs, options.mountPoint, category.category, title);
	const deleted = await deleteMemoryEntry(ctx.fs, options.mountPoint, category.category, title);
	if (!deleted) {
		return commandError(`x-memory delete: memory not found: ${title}\n`, 1);
	}
	if (current) {
		await ctx.fs.rm(resolveMemoryHomePath(ctx.fs, options.mountPoint, current.entry.path), {
			force: true,
		});
	}

	return {
		stdout: `Delete memory ${title} from category ${category.category} Successfully!\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createDeleteMemoryCommand(
	options: MemoryCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "delete",
		type: "command",
		summary: "Delete a memory entry.",
		description: "Deletes daily memory metadata and its indexed body file reference.",
		usage: "x-memory delete <title> [--category daily]",
		args: [
			{
				name: "title",
				required: true,
				summary: "Daily memory title to delete.",
			},
		],
		flags: {
			category: {
				description: "Category for the memory entry. Only daily is supported for now.",
				type: "string",
			},
		},
		run: ({ args: { title }, flags: { category } }, ctx) =>
			deleteMemory({ category, title }, ctx, options),
	});
}
