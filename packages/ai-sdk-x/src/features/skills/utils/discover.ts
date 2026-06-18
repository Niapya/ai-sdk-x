import type { IFileSystem } from "just-bash";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";
import type { JsonRecord } from "@/utils/json";

const SKILL_FILENAME = "SKILL.md";
const CONVENTIONAL_SKILL_DIRS = [
	"skills",
	".agents/skills",
	".codex/skills",
	".claude/skills",
	".opencode/skills",
] as const;
const RECURSIVE_SKIP_DIRS = new Set([
	".git",
	".hg",
	".svn",
	"node_modules",
	"dist",
	"build",
	".next",
	"coverage",
	".turbo",
	".cache",
	"out",
]);

export interface DiscoveredSkill {
	description: string;
	directoryName: string;
	frontmatter: JsonRecord;
	name: string;
	path: string;
	relativePath: string;
	skillFilePath: string;
}

export async function discoverSkills(
	fs: IFileSystem,
	rootPath: string,
): Promise<DiscoveredSkill[]> {
	const normalizedRoot = fs.resolvePath("/", rootPath);
	const direct = await readSkill(fs, normalizedRoot, normalizedRoot);
	if (direct) {
		return [direct];
	}

	const discovered = new Map<string, DiscoveredSkill>();
	for (const directory of CONVENTIONAL_SKILL_DIRS) {
		const basePath = fs.resolvePath(normalizedRoot, directory);
		if (!(await isDirectory(fs, basePath))) {
			continue;
		}

		for (const entry of await fs.readdir(basePath)) {
			const candidatePath = fs.resolvePath(basePath, entry);
			if (!(await isDirectory(fs, candidatePath))) {
				continue;
			}

			const skill = await readSkill(fs, normalizedRoot, candidatePath);
			if (skill) {
				discovered.set(skill.path, skill);
			}
		}
	}

	if (discovered.size > 0) {
		return [...discovered.values()].sort(compareDiscoveredSkills);
	}

	await discoverRecursive(fs, normalizedRoot, normalizedRoot, discovered);
	return [...discovered.values()].sort(compareDiscoveredSkills);
}

export function selectDiscoveredSkill(
	skills: DiscoveredSkill[],
	selector: string | undefined,
): DiscoveredSkill | { error: string } {
	if (skills.length === 0) {
		return { error: "no installable skills found" };
	}

	if (!selector) {
		if (skills.length === 1) {
			return skills[0];
		}

		return {
			error: `multiple skills found; pass @name to choose one: ${skills
				.map((skill) => skill.name)
				.join(", ")}`,
		};
	}

	const normalizedSelector = selector.trim();
	const matches = skills.filter((skill) => skillMatchesSelector(skill, normalizedSelector));
	if (matches.length === 1) {
		return matches[0];
	}

	if (matches.length > 1) {
		return {
			error: `multiple skills match @${normalizedSelector}: ${matches
				.map((skill) => skill.relativePath || skill.name)
				.join(", ")}`,
		};
	}

	return { error: `skill not found for @${normalizedSelector}` };
}

export function sanitizeSkillName(name: string): string {
	return name.trim().replace(/[\\/]+/g, "-");
}

export function relativePathFromRoot(fs: IFileSystem, rootPath: string, path: string): string {
	const normalizedRoot = fs.resolvePath("/", rootPath).replace(/\/+$/, "");
	const normalizedPath = fs.resolvePath("/", path);
	if (normalizedPath === normalizedRoot) {
		return "";
	}

	return normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, "");
}

async function discoverRecursive(
	fs: IFileSystem,
	rootPath: string,
	directory: string,
	discovered: Map<string, DiscoveredSkill>,
): Promise<void> {
	const direct = await readSkill(fs, rootPath, directory);
	if (direct) {
		discovered.set(direct.path, direct);
		return;
	}

	for (const entry of await fs.readdir(directory)) {
		if (RECURSIVE_SKIP_DIRS.has(entry)) {
			continue;
		}

		const path = fs.resolvePath(directory, entry);
		if (await isDirectory(fs, path)) {
			await discoverRecursive(fs, rootPath, path, discovered);
		}
	}
}

async function readSkill(
	fs: IFileSystem,
	rootPath: string,
	directory: string,
): Promise<DiscoveredSkill | undefined> {
	const skillFilePath = fs.resolvePath(directory, SKILL_FILENAME);
	if (!(await fs.exists(skillFilePath))) {
		return undefined;
	}

	const markdown = await fs.readFile(skillFilePath);
	const { frontmatter } = parseMarkdownFrontmatter(markdown);
	const name = frontmatter.name;
	const description = frontmatter.description;
	if (typeof name !== "string" || typeof description !== "string") {
		return undefined;
	}

	return {
		description,
		directoryName: directory.split("/").filter(Boolean).at(-1) ?? "",
		frontmatter,
		name,
		path: directory,
		relativePath: relativePathFromRoot(fs, rootPath, directory),
		skillFilePath,
	};
}

async function isDirectory(fs: IFileSystem, path: string): Promise<boolean> {
	if (!(await fs.exists(path))) {
		return false;
	}

	return (await fs.stat(path)).isDirectory;
}

function compareDiscoveredSkills(left: DiscoveredSkill, right: DiscoveredSkill): number {
	return left.relativePath.localeCompare(right.relativePath);
}

function skillMatchesSelector(skill: DiscoveredSkill, selector: string): boolean {
	return (
		skill.name === selector ||
		skill.directoryName === selector ||
		skill.relativePath.split("/").filter(Boolean).at(-1) === selector
	);
}
