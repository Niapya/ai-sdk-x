import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { getMemoryEntry, parseMemoryRef } from "@/features/memory/utils/store";
import { commandError, defineCliCommand } from "@/utils/command";

export async function getMemory(
	ref: string,
	fs: IFileSystem,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const parsed = parseMemoryRef(ref);
	if (!parsed) {
		return commandError("x-memory get: expected <date:title>\n", 1);
	}

	const found = await getMemoryEntry(fs, options.mountPoint, parsed.date, parsed.title);
	if (!found) {
		return commandError(`x-memory get: memory not found: ${ref}\n`, 1);
	}

	return {
		stdout: `${JSON.stringify(found, null, 2)}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createGetMemoryCommand(
	options: MemoryCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "get",
		type: "command",
		summary: "Show a memory entry.",
		usage: "x-memory get <date:title>",
		args: [
			{
				name: "ref",
				required: true,
				summary: "Memory reference formatted as YYYY-MM-DD:title.",
			},
		],
		run: ({ args: { ref } }, ctx) => getMemory(ref, ctx.fs, options),
	});
}
