import type { ExecResult, IFileSystem } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import {
	listSkillCatalog,
	type PaginationInput,
	paginate,
	parsePagination,
	renderSkillSummary,
} from "@/features/skills/utils/output";
import { defineCliCommand } from "@/utils/command";

export interface ListSkillsInput extends PaginationInput {}

export async function listSkills(
	fs: IFileSystem,
	options: SkillsCommandOptions,
	input: ListSkillsInput = {},
): Promise<ExecResult> {
	const pagination = parsePagination(input);
	if ("error" in pagination) {
		return pagination.error;
	}

	const entries = await listSkillCatalog(fs, options);
	const page = paginate(entries, pagination);
	const header = [
		"All available skills in the mount point will be listed.",
		"View specific skills via the skill file path.",
		`Page ${pagination.page}/${page.pageCount}, limit ${pagination.limit}, total ${page.total}.`,
	];
	const body = page.items.map(renderSkillSummary);

	return {
		stdout: `${[...header, ...body].join("\n\n")}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createListSkillsCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "list",
		type: "command",
		summary: "List installed skills.",
		usage: "x-skills list [--page <page>] [--limit <limit>]",
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
		run: ({ flags: { limit, page } }, ctx) => listSkills(ctx.fs, options, { limit, page }),
	});
}
