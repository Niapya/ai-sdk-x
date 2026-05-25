import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/commands/memory/types";
import { collectMemoryFiles } from "@/commands/memory/utils/shared";
import { type CliCommandDefinition, defineCliCommand } from "@/utils/command";

export async function listMemory(
	fs: IFileSystem,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const cached = await options.cache?.get("memory:list");
	if (cached !== null && cached !== undefined) {
		return { stdout: cached, stderr: "", exitCode: 0 };
	}

	const paths = await collectMemoryFiles(fs, options.mountPoint);
	const stdout = paths.length > 0 ? `${paths.join("\n")}\n` : "";
	await options.cache?.set("memory:list", stdout);
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
