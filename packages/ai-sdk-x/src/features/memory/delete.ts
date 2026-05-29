import type { CommandContext, ExecResult } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { deleteMemoryEntry, parseMemoryRef } from "@/features/memory/utils/store";
import { commandError, defineCliCommand } from "@/utils/command";

export async function deleteMemory(
	ref: string,
	ctx: CommandContext,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const parsed = parseMemoryRef(ref);
	if (!parsed) {
		return commandError("x-memory delete: expected <date:title>\n", 1);
	}

	const deleted = await deleteMemoryEntry(ctx.fs, options.mountPoint, parsed.date, parsed.title);
	if (!deleted) {
		return commandError(`x-memory delete: memory not found: ${ref}\n`, 1);
	}

	return { stdout: `Deleted ${parsed.date}:${parsed.title}\n`, stderr: "", exitCode: 0 };
}

export function createDeleteMemoryCommand(
	options: MemoryCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "delete",
		type: "command",
		summary: "Delete a memory entry.",
		usage: "x-memory delete <date:title>",
		args: [
			{
				name: "ref",
				required: true,
				summary: "Memory reference formatted as YYYY-MM-DD:title.",
			},
		],
		run: ({ args: { ref } }, ctx) => deleteMemory(ref, ctx, options),
	});
}
