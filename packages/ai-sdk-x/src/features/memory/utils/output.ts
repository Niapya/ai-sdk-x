import type { MemoryEntryRef } from "@/features/memory/utils/lockfile";
import { DAILY_MEMORY_CATEGORY } from "@/features/memory/utils/lockfile";
import { commandError } from "@/utils/command";

export interface PaginationInput {
	limit?: string;
	page?: string;
}

export interface Pagination {
	limit: number;
	page: number;
}

export function parsePagination(
	input: PaginationInput,
): Pagination | { error: ReturnType<typeof commandError> } {
	const page = parsePositiveInteger(input.page ?? "1");
	const limit = parsePositiveInteger(input.limit ?? "10");

	if (!page) {
		return { error: commandError("x-memory: --page must be a positive integer\n", 1) };
	}
	if (!limit) {
		return { error: commandError("x-memory: --limit must be a positive integer\n", 1) };
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

export function validateDailyCategory(
	category: string | undefined,
	commandName: string,
): { category: typeof DAILY_MEMORY_CATEGORY } | { error: ReturnType<typeof commandError> } {
	const normalized = category?.trim().toLowerCase() || DAILY_MEMORY_CATEGORY;
	if (normalized !== DAILY_MEMORY_CATEGORY) {
		return {
			error: commandError(
				`${commandName}: only daily category is supported for now: ${category}\n`,
				1,
			),
		};
	}

	return { category: DAILY_MEMORY_CATEGORY };
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

export function renderMemoryMetadata(ref: MemoryEntryRef, keyword?: string): string {
	const highlight = (value: string) => (keyword ? highlightAscii(value, keyword) : value);
	return [
		`Name: ${highlight(ref.title)}`,
		`Category: ${highlight(ref.category)}`,
		`Description: ${highlight(ref.entry.description)}`,
		`Keywords: ${highlight(ref.entry.keywords.join(", "))}`,
		`File Path: ${ref.entry.path}`,
	].join("\n");
}

export function memoryMetadataMatches(ref: MemoryEntryRef, query: string): boolean {
	const normalized = query.toLowerCase();
	return [ref.title, ref.category, ref.entry.description, ...ref.entry.keywords].some((value) =>
		value.toLowerCase().includes(normalized),
	);
}

export function renderMemoryTree(input: {
	coreFiles: string[];
	dailyEntries: MemoryEntryRef[];
	memoryHome: string;
}): string {
	const lines = [
		`Memory files in ${input.memoryHome}:`,
		"",
		"Core:",
		...input.coreFiles.map((file) => `- ${file}`),
		"",
		"daily/",
	];

	if (input.dailyEntries.length === 0) {
		lines.push("- (empty)");
	} else {
		for (const ref of input.dailyEntries) {
			lines.push(`- ${ref.title}`);
			lines.push(`  Description: ${ref.entry.description}`);
			lines.push(`  Keywords: ${ref.entry.keywords.join(", ")}`);
			lines.push(`  File Path: ${ref.entry.path}`);
		}
	}

	return lines.join("\n");
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
