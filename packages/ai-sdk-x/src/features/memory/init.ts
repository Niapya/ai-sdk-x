import type { CommandContext, ExecResult } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { initMemoryIndex, MEMORY_CORE_FILES } from "@/features/memory/utils/lockfile";
import { defineCliCommand } from "@/utils/command";

export async function initMemory(
	ctx: CommandContext,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	await initMemoryIndex(ctx.fs, options.mountPoint);
	return {
		stdout: `${[
			`initialized\t${options.mountPoint}`,
			`agent\t${ctx.fs.resolvePath(options.mountPoint, MEMORY_CORE_FILES.agent)}`,
			`user\t${ctx.fs.resolvePath(options.mountPoint, MEMORY_CORE_FILES.user)}`,
			`shared\t${ctx.fs.resolvePath(options.mountPoint, MEMORY_CORE_FILES.shared)}`,
			`index\t${ctx.fs.resolvePath(options.mountPoint, "memory.json")}`,
		].join("\n")}\n`,
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
		summary: "Create the memory index and core files.",
		usage: "x-memory init",
		run: (_input, ctx) => initMemory(ctx, options),
	});
}
