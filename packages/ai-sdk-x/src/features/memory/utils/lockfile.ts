import type { IFileSystem } from "just-bash";
import type { MemoryEntry, MemoryIndex } from "@/features/memory/types";
import { memoryIndexSchema } from "@/features/memory/types";
import {
	initLockfile,
	readLockfile,
	resolveTokenPath,
	toTokenPath,
	writeLockfile,
} from "@/utils/lockfile";

const MEMORY_INDEX_FILE = "memory.json";
const MEMORY_HOME_TOKEN = "$MEMORY_HOME";
export const DAILY_MEMORY_CATEGORY = "daily";
export const MEMORY_CORE_FILES = {
	agent: "AGENT.md",
	shared: "MEMORY.md",
	user: "USER.md",
} as const;

export type MemoryCoreName = keyof typeof MEMORY_CORE_FILES;

export interface MemoryEntryRef {
	category: string;
	entry: MemoryEntry;
	title: string;
}

export async function readMemoryIndex(fs: IFileSystem, memoryMount: string): Promise<MemoryIndex> {
	return readLockfile(memoryIndexLockfileOptions(fs, memoryMount));
}

export async function initMemoryIndex(fs: IFileSystem, memoryMount: string): Promise<MemoryIndex> {
	return initLockfile(memoryIndexLockfileOptions(fs, memoryMount), () =>
		ensureMemoryCoreFiles(fs, memoryMount),
	);
}

export async function ensureMemoryCoreFiles(fs: IFileSystem, memoryMount: string): Promise<void> {
	await fs.mkdir(memoryMount, { recursive: true });
	for (const filename of Object.values(MEMORY_CORE_FILES)) {
		const path = fs.resolvePath(memoryMount, filename);
		if (!(await fs.exists(path))) {
			await fs.writeFile(path, "");
		}
	}
}

export async function upsertMemoryEntry(
	fs: IFileSystem,
	memoryMount: string,
	input: {
		body?: string;
		category: string;
		description: string;
		keywords: string[];
		now?: Date;
		path?: string;
		title: string;
	},
): Promise<MemoryEntryRef> {
	const index = await readMemoryIndex(fs, memoryMount);
	const nowDate = input.now ?? new Date();
	const now = nowDate.getTime();
	const category = normalizeCategory(input.category);
	const categoryEntries = index.categories[category] ?? {};
	const current = categoryEntries[input.title];
	const path = input.path ?? current?.path ?? createMemoryEntryPath(category, input.title, nowDate);
	categoryEntries[input.title] = {
		category,
		createAt: current?.createAt ?? now,
		description: input.description,
		keywords: normalizeKeywords(input.keywords),
		path,
		updateAt: now,
	};
	index.categories[category] = categoryEntries;
	if (input.body !== undefined) {
		const resolvedPath = resolveMemoryHomePath(fs, memoryMount, path);
		await fs.mkdir(parentPath(resolvedPath), { recursive: true });
		await fs.writeFile(resolvedPath, input.body);
	}
	await writeLockfile(memoryIndexLockfileOptions(fs, memoryMount), index);
	return { category, entry: categoryEntries[input.title], title: input.title };
}

export async function deleteMemoryEntry(
	fs: IFileSystem,
	memoryMount: string,
	category: string,
	title: string,
): Promise<boolean> {
	const index = await readMemoryIndex(fs, memoryMount);
	const entries = index.categories[category];
	if (!entries?.[title]) {
		return false;
	}

	delete entries[title];
	if (Object.keys(entries).length === 0) {
		delete index.categories[category];
	}
	await writeLockfile(memoryIndexLockfileOptions(fs, memoryMount), index);
	return true;
}

export async function getMemoryEntry(
	fs: IFileSystem,
	memoryMount: string,
	category: string,
	title: string,
): Promise<MemoryEntryRef | undefined> {
	const index = await readMemoryIndex(fs, memoryMount);
	const entry = index.categories[category]?.[title];
	return entry ? { category, entry, title } : undefined;
}

export function listMemoryEntries(index: MemoryIndex): MemoryEntryRef[] {
	return Object.entries(index.categories)
		.flatMap(([category, entries]) =>
			Object.entries(entries).map(([title, entry]) => ({
				category,
				entry,
				title,
			})),
		)
		.sort((left, right) => {
			const byDate = left.category.localeCompare(right.category);
			return byDate === 0 ? left.title.localeCompare(right.title) : byDate;
		});
}

export function listDailyMemoryEntries(index: MemoryIndex): MemoryEntryRef[] {
	const entries = index.categories[DAILY_MEMORY_CATEGORY] ?? {};
	return Object.entries(entries)
		.map(([title, entry]) => ({
			category: DAILY_MEMORY_CATEGORY,
			entry,
			title,
		}))
		.sort((left, right) => left.title.localeCompare(right.title));
}

export function formatMemoryEntry(ref: MemoryEntryRef): string {
	return [
		formatMemoryRef(ref.category, ref.title),
		ref.title,
		ref.entry.description,
		ref.entry.keywords.join(","),
		ref.entry.path,
	].join("\t");
}

export function formatMemoryRef(category: string, title: string): string {
	return `${category}:${title}`;
}

export function parseMemoryRef(value: string): { category: string; title: string } | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return undefined;
	}

	const separator = trimmed.indexOf(":");
	if (separator > 0) {
		const category = normalizeCategory(trimmed.slice(0, separator).trim());
		const title = trimmed.slice(separator + 1).trim();
		return category && title ? { category, title } : undefined;
	}

	return undefined;
}

export function isMemoryCoreFileName(
	value: string,
): value is (typeof MEMORY_CORE_FILES)[MemoryCoreName] {
	const trimmed = value.trim();
	return Object.values(MEMORY_CORE_FILES).some((filename) => filename === trimmed);
}

export function coreFilePath(fs: IFileSystem, memoryMount: string, filename: string): string {
	return fs.resolvePath(memoryMount, filename);
}

export function normalizeCategory(category: string | undefined): string {
	return normalizeMemorySlug(category || "daily", "daily");
}

export function resolveMemoryHomePath(fs: IFileSystem, memoryMount: string, path: string): string {
	return resolveTokenPath(fs, memoryMount, MEMORY_HOME_TOKEN, path);
}

export function toMemoryHomePath(fs: IFileSystem, memoryMount: string, path: string): string {
	return toTokenPath(fs, memoryMount, MEMORY_HOME_TOKEN, path);
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
	return { version: 1, categories: {} };
}

function memoryIndexLockfileOptions(fs: IFileSystem, memoryMount: string) {
	return {
		createEmpty: createEmptyMemoryIndex,
		filename: MEMORY_INDEX_FILE,
		fs,
		mountPoint: memoryMount,
		parse: parseMemoryIndex,
	};
}

function parseMemoryIndex(value: unknown): MemoryIndex | undefined {
	const parsed = memoryIndexSchema.safeParse(value);
	return parsed.success ? parsed.data : undefined;
}

function createMemoryEntryPath(category: string, title: string, now: Date): string {
	const slug = normalizeMemorySlug(title, "memory");
	if (category === DAILY_MEMORY_CATEGORY) {
		return `${MEMORY_HOME_TOKEN}/daily/${now.toISOString().slice(0, 10)}/${slug}.md`;
	}
	return `${MEMORY_HOME_TOKEN}/${category}/${slug}.md`;
}

export function normalizeMemorySlug(value: string, fallback: string): string {
	const slug = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+/, "")
		.replace(/-+$/, "");
	return slug || fallback;
}

function parentPath(path: string): string {
	const index = path.lastIndexOf("/");
	return index <= 0 ? "/" : path.slice(0, index);
}
