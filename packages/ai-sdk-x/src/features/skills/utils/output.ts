import type { IFileSystem } from "just-bash";
import type { SkillIndexEntry, SkillsCommandOptions } from "@/features/skills/types";
import {
	findSkillMarkdownFile,
	readSkillsIndex,
	toSkillsHomePath,
} from "@/features/skills/utils/lockfile";
import { frontmatterDescription, stringifyFrontmatter } from "@/features/skills/utils/metadata";
import { commandError } from "@/utils/command";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";

export interface PaginationInput {
	limit?: string;
	page?: string;
}

export interface Pagination {
	limit: number;
	page: number;
}

export interface SkillCatalogEntry {
	description: string;
	files: string[];
	frontmatter: Record<string, string>;
	indexEntry?: SkillIndexEntry;
	skillFilePath: string;
	source: string;
	title: string;
}

export function parsePagination(
	input: PaginationInput,
): Pagination | { error: ReturnType<typeof commandError> } {
	const page = parsePositiveInteger(input.page ?? "1");
	const limit = parsePositiveInteger(input.limit ?? "10");

	if (!page) {
		return { error: commandError("x-skills: --page must be a positive integer\n", 1) };
	}
	if (!limit) {
		return { error: commandError("x-skills: --limit must be a positive integer\n", 1) };
	}

	return { page, limit };
}

export function paginate<T>(
	items: T[],
	pagination: Pagination,
): { items: T[]; pageCount: number; total: number } {
	const total = items.length;
	const pageCount = Math.max(1, Math.ceil(total / pagination.limit));
	const start = (pagination.page - 1) * pagination.limit;
	return {
		items: items.slice(start, start + pagination.limit),
		pageCount,
		total,
	};
}

export async function listSkillCatalog(
	fs: IFileSystem,
	options: SkillsCommandOptions,
): Promise<SkillCatalogEntry[]> {
	if (!(await fs.exists(options.mountPoint))) {
		return [];
	}

	const index = await readSkillsIndex(fs, options.mountPoint);
	const entries: SkillCatalogEntry[] = [];

	for (const title of await fs.readdir(options.mountPoint)) {
		if (title === "skills.json") {
			continue;
		}

		const skillDir = fs.resolvePath(options.mountPoint, title);
		const stat = await fs.stat(skillDir);
		if (!stat.isDirectory) {
			continue;
		}

		const skillFilePath = await findSkillMarkdownFile(fs, skillDir);
		if (!skillFilePath) {
			continue;
		}

		const markdown = await fs.readFile(skillFilePath);
		const { frontmatter } = parseMarkdownFrontmatter(markdown);
		const stringFrontmatter = stringifyFrontmatter(frontmatter);
		const indexEntry = index.skills[title];
		const files = indexEntry?.files ?? [toSkillsHomePath(fs, options.mountPoint, skillFilePath)];

		entries.push({
			description: frontmatterDescription(frontmatter).trim() || indexEntry?.description || "",
			files,
			frontmatter: stringFrontmatter,
			indexEntry,
			skillFilePath: toSkillsHomePath(fs, options.mountPoint, skillFilePath),
			source: indexEntry?.source ?? "",
			title,
		});
	}

	return entries.sort((left, right) => left.title.localeCompare(right.title));
}

export function renderSkillSummary(
	entry: Pick<SkillCatalogEntry, "description" | "skillFilePath" | "source" | "title">,
): string {
	return [
		`Title: ${entry.title}`,
		`Description: ${entry.description}`,
		`File Path: ${entry.skillFilePath}`,
		`Source: ${entry.source}`,
	].join("\n");
}

export function renderSkillMetadata(input: {
	description: string;
	files?: string[];
	skillFile: string;
	skillsName: string;
	source?: string;
}): string {
	const lines = [
		`Skills Name: ${input.skillsName}`,
		`Description: ${input.description}`,
		`Skill File: ${input.skillFile}`,
	];

	if (input.source !== undefined) {
		lines.push(`Source: ${input.source}`);
	}
	if (input.files) {
		lines.push("Files:");
		lines.push(...input.files.map((file) => `- ${file}`));
	}

	return lines.join("\n");
}

export function renderFrontmatter(frontmatter: Record<string, string>): string {
	const lines = Object.entries(frontmatter)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, value]) => `${key}: ${value}`);

	return lines.length > 0 ? lines.join("\n") : "(empty)";
}

export function renderFileList(files: string[]): string {
	return files.length > 0 ? files.map((file) => `- ${file}`).join("\n") : "(none)";
}

export function highlightAscii(value: string, keyword: string): string {
	if (!keyword) {
		return value;
	}

	const lowerValue = value.toLowerCase();
	const lowerKeyword = keyword.toLowerCase();
	let output = "";
	let index = 0;

	while (index < value.length) {
		const matchIndex = lowerValue.indexOf(lowerKeyword, index);
		if (matchIndex === -1) {
			output += value.slice(index);
			break;
		}

		output += value.slice(index, matchIndex);
		output += `[[${value.slice(matchIndex, matchIndex + keyword.length)}]]`;
		index = matchIndex + keyword.length;
	}

	return output;
}

export function frontmatterPreview(
	frontmatter: Record<string, string>,
	keyword: string,
	limit = 3,
): string {
	const lines = Object.entries(frontmatter)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, value]) => `${key}: ${value}`);
	const lowerKeyword = keyword.toLowerCase();
	const matchingLines = lines.filter((line) => line.toLowerCase().includes(lowerKeyword));
	const selectedLines = matchingLines.length > 0 ? matchingLines : lines.slice(0, limit);

	if (selectedLines.length === 0) {
		return "(empty)";
	}

	return selectedLines.map((line) => highlightAscii(line, keyword)).join("\n");
}

function parsePositiveInteger(value: string): number | undefined {
	if (!/^\d+$/.test(value)) {
		return undefined;
	}

	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		return undefined;
	}

	return parsed;
}
