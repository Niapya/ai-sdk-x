import type { IFileSystem } from "just-bash";
import type { MemoryEntry, MemoryIndex } from "@/features/memory/types";

const MEMORY_INDEX_FILE = "memory.json";
const MEMORY_HOME_TOKEN = "$MEMORY_HOME";
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
	await ensureMemoryCoreFiles(fs, memoryMount);
	await writeMemoryIndex(fs, memoryMount, index);
	return index;
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
	await writeMemoryIndex(fs, memoryMount, index);
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
	await writeMemoryIndex(fs, memoryMount, index);
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

export function normalizeCategory(category: string | undefined): string {
	return (
		(category?.trim() || "daily")
			.toLowerCase()
			.replace(/[^a-z0-9._-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "daily"
	);
}

export function resolveMemoryHomePath(fs: IFileSystem, memoryMount: string, path: string): string {
	if (path === MEMORY_HOME_TOKEN) {
		return memoryMount;
	}
	if (path.startsWith(`${MEMORY_HOME_TOKEN}/`)) {
		return fs.resolvePath(memoryMount, path.slice(MEMORY_HOME_TOKEN.length + 1));
	}
	return path;
}

export function toMemoryHomePath(fs: IFileSystem, memoryMount: string, path: string): string {
	const normalizedMount = fs.resolvePath("/", memoryMount);
	const normalizedPath = fs.resolvePath("/", path);
	if (normalizedPath === normalizedMount) {
		return MEMORY_HOME_TOKEN;
	}
	if (normalizedPath.startsWith(`${normalizedMount}/`)) {
		return `${MEMORY_HOME_TOKEN}${normalizedPath.slice(normalizedMount.length)}`;
	}
	return path;
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

function isMemoryIndex(value: unknown): value is MemoryIndex {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const version = Object.getOwnPropertyDescriptor(value, "version")?.value;
	const categories = Object.getOwnPropertyDescriptor(value, "categories")?.value;
	if (
		version !== 1 ||
		categories === null ||
		typeof categories !== "object" ||
		Array.isArray(categories)
	) {
		return false;
	}

	return Object.values(categories).every(isMemoryEntryRecord);
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
	const category = Object.getOwnPropertyDescriptor(value, "category")?.value;
	const path = Object.getOwnPropertyDescriptor(value, "path")?.value;
	const createAt = Object.getOwnPropertyDescriptor(value, "createAt")?.value;
	const updateAt = Object.getOwnPropertyDescriptor(value, "updateAt")?.value;

	return (
		typeof category === "string" &&
		typeof description === "string" &&
		typeof path === "string" &&
		Array.isArray(keywords) &&
		keywords.every((keyword) => typeof keyword === "string") &&
		typeof createAt === "number" &&
		Number.isFinite(createAt) &&
		typeof updateAt === "number" &&
		Number.isFinite(updateAt)
	);
}

function createMemoryEntryPath(category: string, title: string, now: Date): string {
	const slug =
		title
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9._-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "memory";
	if (category === "daily") {
		return `${MEMORY_HOME_TOKEN}/daily/${now.toISOString().slice(0, 10)}/${slug}.md`;
	}
	return `${MEMORY_HOME_TOKEN}/${category}/${slug}.md`;
}

function parentPath(path: string): string {
	const index = path.lastIndexOf("/");
	return index <= 0 ? "/" : path.slice(0, index);
}
