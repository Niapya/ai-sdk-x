import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import {
	formatMemoryEntry,
	listMemoryEntries,
	readMemoryIndex,
} from "@/features/memory/utils/lockfile";
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
	const index = await readMemoryIndex(fs, options.mountPoint);
	for (const ref of listMemoryEntries(index)) {
		const haystack = [ref.category, ref.title, ref.entry.description, ...ref.entry.keywords]
			.join("\n")
			.toLowerCase();
		if (haystack.includes(normalizedQuery)) {
			matches.push(formatMemoryEntry(ref));
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
		summary: "Search memory metadata for matching text.",
		description:
			"Searches category, title, description, and keywords only; it does not scan body files.",
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
