import type { IFileSystem } from "just-bash";
import type { MemoryEntry, MemoryIndex } from "@/features/memory/types";

const MEMORY_INDEX_FILE = "memory.json";

export interface MemoryEntryRef {
	date: string;
	entry: MemoryEntry;
	title: string;
}

export async function readMemoryIndex(fs: IFileSystem, memoryMount: string): Promise<MemoryIndex> {
	const path = fs.resolvePath(memoryMount, MEMORY_INDEX_FILE);
	if (!(await fs.exists(path))) {
		return createEmptyMemoryIndex();
	}

	try {
		const parsed = JSON.parse(await fs.readFile(path));
		if (!isMemoryIndex(parsed)) {
			return createEmptyMemoryIndex();
		}
		return parsed;
	} catch {
		return createEmptyMemoryIndex();
	}
}

export async function writeMemoryIndex(
	fs: IFileSystem,
	memoryMount: string,
	index: MemoryIndex,
): Promise<void> {
	await fs.mkdir(memoryMount, { recursive: true });
	await fs.writeFile(
		fs.resolvePath(memoryMount, MEMORY_INDEX_FILE),
		`${JSON.stringify(index, null, 2)}\n`,
	);
}

export async function initMemoryIndex(fs: IFileSystem, memoryMount: string): Promise<MemoryIndex> {
	const index = await readMemoryIndex(fs, memoryMount);
	await writeMemoryIndex(fs, memoryMount, index);
	return index;
}

export async function upsertMemoryEntry(
	fs: IFileSystem,
	memoryMount: string,
	input: {
		date: string;
		description: string;
		keywords: string[];
		title: string;
	},
): Promise<MemoryIndex> {
	const index = await readMemoryIndex(fs, memoryMount);
	const now = Date.now();
	const dateEntries = index.daily[input.date] ?? {};
	const current = dateEntries[input.title];
	dateEntries[input.title] = {
		createAt: current?.createAt ?? now,
		description: input.description,
		keywords: normalizeKeywords(input.keywords),
		updateAt: now,
	};
	index.daily[input.date] = dateEntries;
	await writeMemoryIndex(fs, memoryMount, index);
	return index;
}

export async function deleteMemoryEntry(
	fs: IFileSystem,
	memoryMount: string,
	date: string,
	title: string,
): Promise<boolean> {
	const index = await readMemoryIndex(fs, memoryMount);
	const entries = index.daily[date];
	if (!entries?.[title]) {
		return false;
	}

	delete entries[title];
	if (Object.keys(entries).length === 0) {
		delete index.daily[date];
	}
	await writeMemoryIndex(fs, memoryMount, index);
	return true;
}

export async function getMemoryEntry(
	fs: IFileSystem,
	memoryMount: string,
	date: string,
	title: string,
): Promise<MemoryEntryRef | undefined> {
	const index = await readMemoryIndex(fs, memoryMount);
	const entry = index.daily[date]?.[title];
	return entry ? { date, entry, title } : undefined;
}

export function listMemoryEntries(index: MemoryIndex): MemoryEntryRef[] {
	return Object.entries(index.daily)
		.flatMap(([date, entries]) =>
			Object.entries(entries).map(([title, entry]) => ({
				date,
				entry,
				title,
			})),
		)
		.sort((left, right) => {
			const byDate = left.date.localeCompare(right.date);
			return byDate === 0 ? left.title.localeCompare(right.title) : byDate;
		});
}

export function formatMemoryEntry(ref: MemoryEntryRef): string {
	const keywords = ref.entry.keywords.length > 0 ? ` [${ref.entry.keywords.join(",")}]` : "";
	return `${ref.date}\t${ref.title}\t${ref.entry.description}${keywords}`;
}

export function parseMemoryRef(value: string): { date: string; title: string } | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}

	const separator = trimmed.indexOf(":");
	if (separator > 0) {
		const date = trimmed.slice(0, separator).trim();
		const title = trimmed.slice(separator + 1).trim();
		return date && title ? { date, title } : undefined;
	}

	return undefined;
}

export function normalizeKeywords(keywords: string[]): string[] {
	return Array.from(
		new Set(
			keywords
				.flatMap((keyword) => keyword.split(","))
				.map((keyword) => keyword.trim())
				.filter(Boolean),
		),
	);
}

function createEmptyMemoryIndex(): MemoryIndex {
	return { version: 1, daily: {} };
}

function isMemoryIndex(value: unknown): value is MemoryIndex {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const version = Object.getOwnPropertyDescriptor(value, "version")?.value;
	const daily = Object.getOwnPropertyDescriptor(value, "daily")?.value;
	if (version !== 1 || daily === null || typeof daily !== "object" || Array.isArray(daily)) {
		return false;
	}

	return Object.values(daily).every(isMemoryEntryRecord);
}

function isMemoryEntryRecord(value: unknown): value is Record<string, MemoryEntry> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	return Object.values(value).every(isMemoryEntry);
}

function isMemoryEntry(value: unknown): value is MemoryEntry {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const description = Object.getOwnPropertyDescriptor(value, "description")?.value;
	const keywords = Object.getOwnPropertyDescriptor(value, "keywords")?.value;
	const createAt = Object.getOwnPropertyDescriptor(value, "createAt")?.value;
	const updateAt = Object.getOwnPropertyDescriptor(value, "updateAt")?.value;

	return (
		typeof description === "string" &&
		Array.isArray(keywords) &&
		keywords.every((keyword) => typeof keyword === "string") &&
		typeof createAt === "number" &&
		Number.isFinite(createAt) &&
		typeof updateAt === "number" &&
		Number.isFinite(updateAt)
	);
}
