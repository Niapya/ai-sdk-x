import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { collectMemoryFiles } from "@/features/memory/utils/shared";
import { type CliCommandDefinition, defineCliCommand } from "@/utils/command";

export async function listMemory(
	fs: IFileSystem,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const paths = await collectMemoryFiles(fs, options.mountPoint);
	const stdout = paths.length > 0 ? `${paths.join("\n")}\n` : "";
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
