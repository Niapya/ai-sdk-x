import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { listDailyMemoryEntries, readMemoryIndex } from "@/features/memory/utils/lockfile";
import {
	memoryMetadataMatches,
	type PaginationInput,
	paginate,
	parsePagination,
	renderMemoryMetadata,
	validateDailyCategory,
} from "@/features/memory/utils/output";
import { commandError, defineCliCommand } from "@/utils/command";

export interface FindMemoryInput extends PaginationInput {
	category?: string;
	query: string;
}

export async function findMemory(
	input: FindMemoryInput,
	fs: IFileSystem,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const query = input.query.trim();
	if (!query) {
		return commandError("x-memory find: missing query\n", 1);
	}

	const category = validateDailyCategory(input.category, "x-memory find");
	if ("error" in category) {
		return category.error;
	}

	const pagination = parsePagination(input);
	if ("error" in pagination) {
		return pagination.error;
	}

	const index = await readMemoryIndex(fs, options.mountPoint);
	const matches = listDailyMemoryEntries(index).filter((ref) => memoryMetadataMatches(ref, query));
	const page = paginate(matches, pagination);
	const header = `Find memory metadata for \`${query}\`(page ${pagination.page}/${page.pageCount}, limit ${pagination.limit}, total ${page.total}), view memory files by the following file path:`;
	const metadataOnlyNotice =
		"Only metadata is searched: name, category, description, and keywords.";
	const body = page.items.map((ref) => renderMemoryMetadata(ref, query));

	return {
		stdout: `${[header, metadataOnlyNotice, ...body].join("\n\n")}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createFindMemoryCommand(
	options: MemoryCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "find",
		type: "command",
		summary: "Find daily memory by metadata.",
		description:
			"Searches daily memory metadata only: name/title, category, description, and keywords. It does not search body files or core files.",
		usage: "x-memory find <query> [--page <page>] [--limit <limit>]",
		args: [
			{
				name: "query",
				multiple: true,
				required: true,
				summary: "Query to find in daily memory metadata.",
			},
		],
		flags: {
			category: {
				description: "Category to search. Only daily is supported for now.",
				type: "string",
			},
			limit: {
				description: "Maximum number of memory entries to show per page.",
				type: "string",
			},
			page: {
				description: "Page number to show.",
				type: "string",
			},
		},
		run: ({ args: { query }, flags: { category, limit, page } }, ctx) =>
			findMemory({ category, limit, page, query: query.join(" ") }, ctx.fs, options),
	});
}
