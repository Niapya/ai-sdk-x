import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import {
	formatMemoryEntry,
	listMemoryEntries,
	readMemoryIndex,
} from "@/features/memory/utils/store";
import { type CliCommandDefinition, defineCliCommand } from "@/utils/command";

export async function listMemory(
	fs: IFileSystem,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const index = await readMemoryIndex(fs, options.mountPoint);
	const entries = listMemoryEntries(index).map(formatMemoryEntry);
	const stdout = entries.length > 0 ? `${entries.join("\n")}\n` : "";
	return { stdout, stderr: "", exitCode: 0 };
}

export function createListMemoryCommand(
	options: MemoryCommandOptions,
): CliCommandDefinition<undefined, undefined> {
	return defineCliCommand({
		id: "list",
		type: "command",
		summary: "List stored memory files.",
		usage: "x-memory list",
		run: (_input, ctx) => listMemory(ctx.fs, options),
	});
}
