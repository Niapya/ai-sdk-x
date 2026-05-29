import type { CommandContext, ExecResult } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { initMemoryIndex } from "@/features/memory/utils/store";
import { defineCliCommand } from "@/utils/command";

export async function initMemory(
	ctx: CommandContext,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	await initMemoryIndex(ctx.fs, options.mountPoint);
	return {
		stdout: `${ctx.fs.resolvePath(options.mountPoint, "memory.json")}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createInitMemoryCommand(
	options: MemoryCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "init",
		type: "command",
		summary: "Create the memory index file.",
		usage: "x-memory init",
		run: (_input, ctx) => initMemory(ctx, options),
	});
}
