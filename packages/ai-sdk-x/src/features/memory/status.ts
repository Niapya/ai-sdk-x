import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { listMemoryEntries, readMemoryIndex } from "@/features/memory/utils/store";
import { defineCliCommand } from "@/utils/command";

export async function statusMemory(
	fs: IFileSystem,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const index = await readMemoryIndex(fs, options.mountPoint);
	const entries = listMemoryEntries(index);
	const dates = new Set(entries.map((entry) => entry.date));

	return {
		stdout: `memoryHome\t${options.mountPoint}\nentries\t${entries.length}\ndates\t${dates.size}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createStatusMemoryCommand(
	options: MemoryCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "status",
		type: "command",
		summary: "Show memory index status.",
		usage: "x-memory status",
		run: (_input, ctx) => statusMemory(ctx.fs, options),
	});
}
