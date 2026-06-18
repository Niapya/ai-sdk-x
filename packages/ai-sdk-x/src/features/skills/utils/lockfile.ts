import type { IFileSystem } from "just-bash";
import type {
	SkillInstallTarget,
	SkillsCommandOptions,
	SkillsIndex,
} from "@/features/skills/types";
import { skillsIndexSchema } from "@/features/skills/types";
import { readLockfile, resolveTokenPath, toTokenPath, writeLockfile } from "@/utils/lockfile";

const SKILL_INDEX_FILE = "skills.json";
const SKILLS_HOME_TOKEN = "$SKILLS_HOME";
export const SKILL_MARKDOWN_FILENAMES = ["SKILLS.md", "SKILL.md"] as const;

export interface UpsertSkillIndexEntryInput {
	description?: string;
	files: string[];
	frontmatter?: Record<string, string>;
	skillPath: string;
	source?: "git" | "local";
	sourcePath?: string;
	target: SkillInstallTarget;
}

export async function upsertSkillIndexEntry(
	fs: IFileSystem,
	options: SkillsCommandOptions,
	input: UpsertSkillIndexEntryInput,
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
		...(input.sourcePath || input.target.sourcePath
			? { sourcePath: input.sourcePath ?? input.target.sourcePath }
			: {}),
		...(input.target.repoUrl ? { url: input.target.repoUrl } : {}),
	};

	await fs.mkdir(options.mountPoint, { recursive: true });
	await writeLockfile(skillsIndexLockfileOptions(fs, options.mountPoint), index);
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
	await writeLockfile(skillsIndexLockfileOptions(fs, skillsMount), index);
	return true;
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

function parseSkillsIndex(value: unknown): SkillsIndex | undefined {
	const parsed = skillsIndexSchema.safeParse(value);
	return parsed.success ? parsed.data : undefined;
}

function createEmptySkillsIndex(): SkillsIndex {
	return { version: 1, skills: {} };
}

function skillsIndexLockfileOptions(fs: IFileSystem, skillsMount: string) {
	return {
		createEmpty: createEmptySkillsIndex,
		filename: SKILL_INDEX_FILE,
		fs,
		mountPoint: skillsMount,
		parse: parseSkillsIndex,
	};
}
