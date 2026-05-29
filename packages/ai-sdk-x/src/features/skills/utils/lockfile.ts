import type { IFileSystem } from "just-bash";
import type {
	SkillIndexEntry,
	SkillInstallTarget,
	SkillsCommandOptions,
	SkillsIndex,
} from "@/features/skills/types";

const SKILL_INDEX_FILE = "skills.json";
const SKILLS_HOME_TOKEN = "$SKILLS_HOME";
export const SKILL_MARKDOWN_FILENAMES = ["SKILLS.md", "SKILL.md"] as const;

export interface WriteSkillIndexEntryInput {
	description?: string;
	files: string[];
	frontmatter?: Record<string, string>;
	skillPath: string;
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
		url: input.target.repoUrl,
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
	await fs.mkdir(skillsMount, { recursive: true });
	await fs.writeFile(
		fs.resolvePath(skillsMount, SKILL_INDEX_FILE),
		`${JSON.stringify(index, null, 2)}\n`,
	);
}

export async function readSkillsIndex(fs: IFileSystem, skillsMount: string): Promise<SkillsIndex> {
	const path = fs.resolvePath(skillsMount, SKILL_INDEX_FILE);
	if (!(await fs.exists(path))) {
		return { version: 1, skills: {} };
	}

	try {
		const parsed = JSON.parse(await fs.readFile(path));
		if (!isSkillsIndex(parsed)) {
			return { version: 1, skills: {} };
		}
		return parsed;
	} catch {
		return { version: 1, skills: {} };
	}
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
	if (path === SKILLS_HOME_TOKEN) {
		return skillsMount;
	}
	if (path.startsWith(`${SKILLS_HOME_TOKEN}/`)) {
		return fs.resolvePath(skillsMount, path.slice(SKILLS_HOME_TOKEN.length + 1));
	}

	return path;
}

export function toSkillsHomePath(fs: IFileSystem, skillsMount: string, path: string): string {
	const normalizedMount = fs.resolvePath("/", skillsMount);
	const normalizedPath = fs.resolvePath("/", path);

	if (normalizedPath === normalizedMount) {
		return SKILLS_HOME_TOKEN;
	}
	if (normalizedPath.startsWith(`${normalizedMount}/`)) {
		return `${SKILLS_HOME_TOKEN}${normalizedPath.slice(normalizedMount.length)}`;
	}

	return path;
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

function isSkillIndexEntry(value: unknown): value is SkillIndexEntry {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const description = Object.getOwnPropertyDescriptor(value, "description")?.value;
	const files = Object.getOwnPropertyDescriptor(value, "files")?.value;
	const frontmatter = Object.getOwnPropertyDescriptor(value, "frontmatter")?.value;
	const skillPath = Object.getOwnPropertyDescriptor(value, "skillPath")?.value;
	const createAt = Object.getOwnPropertyDescriptor(value, "createAt")?.value;
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
		(url === undefined || typeof url === "string")
	);
}

function isStringRecord(value: unknown): value is Record<string, string> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	return Object.values(value).every((entry) => typeof entry === "string");
}
