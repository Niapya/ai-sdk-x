import type { ExecResult, IFileSystem } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import {
	frontmatterPreview,
	highlightAscii,
	listSkillCatalog,
	type PaginationInput,
	paginate,
	parsePagination,
} from "@/features/skills/utils/output";
import { commandError, defineCliCommand } from "@/utils/command";

export interface FindSkillsInput extends PaginationInput {
	keyword: string;
}

export async function findSkills(
	input: FindSkillsInput,
	fs: IFileSystem,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	const keyword = input.keyword.trim();
	if (!keyword) {
		return commandError("x-skills find: missing keyword\n", 1);
	}

	const pagination = parsePagination(input);
	if ("error" in pagination) {
		return pagination.error;
	}

	const lowerKeyword = keyword.toLowerCase();
	const entries = (await listSkillCatalog(fs, options)).filter((entry) => {
		const frontmatterText = Object.entries(entry.frontmatter)
			.map(([key, value]) => `${key}: ${value}`)
			.join("\n");
		return [entry.title, entry.description, frontmatterText].some((value) =>
			value.toLowerCase().includes(lowerKeyword),
		);
	});
	const page = paginate(entries, pagination);
	const header = `Find results for \`${keyword}\`(page ${pagination.page}/${page.pageCount}, limit ${pagination.limit}, total ${page.total}), view the skills by the following file path:`;
	const body = page.items.map((entry) =>
		[
			`Title: ${highlightAscii(entry.title, keyword)}`,
			`Description: ${highlightAscii(entry.description, keyword)}`,
			`File Path: ${entry.skillFilePath}`,
			"Front Matter:",
			frontmatterPreview(entry.frontmatter, keyword),
		].join("\n"),
	);

	return {
		stdout: `${[header, ...body].join("\n\n")}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createFindSkillsCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "find",
		type: "command",
		summary: "Find installed skills by local metadata.",
		usage: "x-skills find <keyword> [--page <page>] [--limit <limit>]",
		args: [
			{
				name: "keyword",
				multiple: true,
				required: true,
				summary: "Keyword to find in title, description, or frontmatter.",
			},
		],
		flags: {
			limit: {
				description: "Maximum number of skills to show per page.",
				type: "string",
			},
			page: {
				description: "Page number to show.",
				type: "string",
			},
		},
		run: ({ args: { keyword }, flags: { limit, page } }, ctx) =>
			findSkills({ keyword: keyword.join(" "), limit, page }, ctx.fs, options),
	});
}
