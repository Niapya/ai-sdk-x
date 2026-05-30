import type { IFileSystem } from "just-bash";
import type {
	SkillIndexEntry,
	SkillInstallTarget,
	SkillsCommandOptions,
	SkillsIndex,
} from "@/features/skills/types";
import { readLockfile, resolveTokenPath, toTokenPath, writeLockfile } from "@/utils/lockfile";

const SKILL_INDEX_FILE = "skills.json";
const SKILLS_HOME_TOKEN = "$SKILLS_HOME";
export const SKILL_MARKDOWN_FILENAMES = ["SKILLS.md", "SKILL.md"] as const;

export interface WriteSkillIndexEntryInput {
	description?: string;
	files: string[];
	frontmatter?: Record<string, string>;
	skillPath: string;
	source?: "git" | "local";
	target: SkillInstallTarget;
}

export async function writeSkillIndexEntry(
	fs: IFileSystem,
	options: SkillsCommandOptions,
	input: WriteSkillIndexEntryInput,
): Promise<void> {
	const index = await readSkillsIndex(fs, options.mountPoint);
	const now = Date.now();
	const current = index.skills[input.target.selector];
	index.skills[input.target.selector] = {
		createAt: current?.createAt ?? now,
		files: input.files.map((file) => toSkillsHomePath(fs, options.mountPoint, file)),
		skillPath: toSkillsHomePath(fs, options.mountPoint, input.skillPath),
		updateAt: now,
		...(input.description ? { description: input.description } : {}),
		...(input.frontmatter && Object.keys(input.frontmatter).length > 0
			? { frontmatter: input.frontmatter }
			: {}),
		source: input.source ?? (input.target.repoUrl ? "git" : "local"),
		...(input.target.repoUrl ? { url: input.target.repoUrl } : {}),
	};

	await fs.mkdir(options.mountPoint, { recursive: true });
	await writeSkillsIndex(fs, options.mountPoint, index);
}

export async function removeSkillIndexEntry(
	fs: IFileSystem,
	skillsMount: string,
	skillName: string,
): Promise<boolean> {
	const index = await readSkillsIndex(fs, skillsMount);
	if (!index.skills[skillName]) {
		return false;
	}

	delete index.skills[skillName];
	await writeSkillsIndex(fs, skillsMount, index);
	return true;
}

export async function writeSkillsIndex(
	fs: IFileSystem,
	skillsMount: string,
	index: SkillsIndex,
): Promise<void> {
	await writeLockfile(skillsIndexLockfileOptions(fs, skillsMount), index);
}

export async function readSkillsIndex(fs: IFileSystem, skillsMount: string): Promise<SkillsIndex> {
	return readLockfile(skillsIndexLockfileOptions(fs, skillsMount));
}

export async function findSkillMarkdownFile(
	fs: IFileSystem,
	skillDir: string,
): Promise<string | undefined> {
	for (const filename of SKILL_MARKDOWN_FILENAMES) {
		const path = fs.resolvePath(skillDir, filename);
		if (await fs.exists(path)) {
			return path;
		}
	}

	return undefined;
}

export function resolveSkillsHomePath(fs: IFileSystem, skillsMount: string, path: string): string {
	return resolveTokenPath(fs, skillsMount, SKILLS_HOME_TOKEN, path);
}

export function toSkillsHomePath(fs: IFileSystem, skillsMount: string, path: string): string {
	return toTokenPath(fs, skillsMount, SKILLS_HOME_TOKEN, path);
}

export async function collectSkillFiles(fs: IFileSystem, skillDir: string): Promise<string[]> {
	if (!(await fs.exists(skillDir))) {
		return [];
	}

	const paths: string[] = [];
	await collectSkillFilesInto(fs, skillDir, paths);
	return paths.sort();
}

async function collectSkillFilesInto(
	fs: IFileSystem,
	directory: string,
	paths: string[],
): Promise<void> {
	for (const entry of await fs.readdir(directory)) {
		const path = fs.resolvePath(directory, entry);
		const stat = await fs.stat(path);
		if (stat.isDirectory) {
			await collectSkillFilesInto(fs, path, paths);
			continue;
		}

		if (stat.isFile) {
			paths.push(path);
		}
	}
}

function isSkillsIndex(value: unknown): value is SkillsIndex {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const version = Object.getOwnPropertyDescriptor(value, "version")?.value;
	const skills = Object.getOwnPropertyDescriptor(value, "skills")?.value;
	if (version !== 1 || skills === null || typeof skills !== "object" || Array.isArray(skills)) {
		return false;
	}

	return Object.values(skills).every(isSkillIndexEntry);
}

function createEmptySkillsIndex(): SkillsIndex {
	return { version: 1, skills: {} };
}

function skillsIndexLockfileOptions(fs: IFileSystem, skillsMount: string) {
	return {
		createEmpty: createEmptySkillsIndex,
		filename: SKILL_INDEX_FILE,
		fs,
		isValid: isSkillsIndex,
		mountPoint: skillsMount,
	};
}

function isSkillIndexEntry(value: unknown): value is SkillIndexEntry {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const description = Object.getOwnPropertyDescriptor(value, "description")?.value;
	const files = Object.getOwnPropertyDescriptor(value, "files")?.value;
	const frontmatter = Object.getOwnPropertyDescriptor(value, "frontmatter")?.value;
	const skillPath = Object.getOwnPropertyDescriptor(value, "skillPath")?.value;
	const createAt = Object.getOwnPropertyDescriptor(value, "createAt")?.value;
	const source = Object.getOwnPropertyDescriptor(value, "source")?.value;
	const updateAt = Object.getOwnPropertyDescriptor(value, "updateAt")?.value;
	const url = Object.getOwnPropertyDescriptor(value, "url")?.value;

	if (description !== undefined && typeof description !== "string") {
		return false;
	}
	if (frontmatter !== undefined && !isStringRecord(frontmatter)) {
		return false;
	}

	return (
		typeof skillPath === "string" &&
		typeof createAt === "number" &&
		Number.isFinite(createAt) &&
		typeof updateAt === "number" &&
		Number.isFinite(updateAt) &&
		Array.isArray(files) &&
		files.every((file) => typeof file === "string") &&
		(source === undefined || source === "git" || source === "local") &&
		(url === undefined || typeof url === "string")
	);
}

function isStringRecord(value: unknown): value is Record<string, string> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	return Object.values(value).every((entry) => typeof entry === "string");
}
