import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { collectMemoryFiles } from "@/features/memory/utils/shared";
import { type CliCommandDefinition, defineCliCommand } from "@/utils/command";

export async function searchMemory(
	query: string,
	fs: IFileSystem,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return { stdout: "", stderr: "x-memory search: missing query\n", exitCode: 1 };
	}

	const matches: string[] = [];
	for (const path of await collectMemoryFiles(fs, options.mountPoint)) {
		const lines = (await fs.readFile(path)).split("\n");
		for (let index = 0; index < lines.length; index++) {
			if (lines[index].toLowerCase().includes(normalizedQuery)) {
				matches.push(`${path}:${index + 1}:${lines[index]}`);
			}
		}
	}

	return {
		stdout: matches.length > 0 ? `${matches.join("\n")}\n` : "",
		stderr: "",
		exitCode: 0,
	};
}

export function createSearchMemoryCommand(options: MemoryCommandOptions): CliCommandDefinition<
	readonly [
		{
			name: "query";
			multiple: true;
			required: true;
			summary: "Text to search for.";
		},
	],
	undefined
> {
	return defineCliCommand({
		id: "search",
		type: "command",
		summary: "Search stored memory for matching text.",
		usage: "x-memory search <query>",
		args: [
			{
				name: "query",
				multiple: true,
				required: true,
				summary: "Text to search for.",
			},
		],
		run: ({ args: { query } }, ctx) => searchMemory(query.join(" "), ctx.fs, options),
	});
}
