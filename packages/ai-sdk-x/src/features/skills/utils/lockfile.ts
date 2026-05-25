import type { IFileSystem } from "just-bash";
import type {
	SkillInstallTarget,
	SkillLockEntry,
	SkillsCommandOptions,
	SkillsLockfile,
} from "@/features/skills/types";
import type { JsonRecord } from "@/utils/json";
import { isJsonRecord } from "@/utils/json";

export async function writeSkillLockfile(
	fs: IFileSystem,
	options: SkillsCommandOptions,
	target: SkillInstallTarget,
	frontmatter: JsonRecord,
	description: string,
): Promise<void> {
	const lockfile = await readSkillLockfile(fs, options.mountPoint);
	lockfile.skills[target.selector] = {
		description,
		frontmatter,
		source: {
			repo: target.repoUrl,
			path: `/skills/${target.selector}`,
			selector: target.selector,
		},
	};

	await fs.mkdir(options.mountPoint, { recursive: true });
	await fs.writeFile(
		fs.resolvePath(options.mountPoint, "skills.json"),
		`${JSON.stringify(lockfile, null, 2)}\n`,
	);
}

export async function readSkillLockfile(
	fs: IFileSystem,
	skillsMount: string,
): Promise<SkillsLockfile> {
	const path = fs.resolvePath(skillsMount, "skills.json");
	if (!(await fs.exists(path))) {
		return { version: 1, skills: {} };
	}

	try {
		const parsed = JSON.parse(await fs.readFile(path));
		if (!isSkillsLockfile(parsed)) {
			return { version: 1, skills: {} };
		}
		return parsed;
	} catch {
		return { version: 1, skills: {} };
	}
}

function isSkillsLockfile(value: unknown): value is SkillsLockfile {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const version = Object.getOwnPropertyDescriptor(value, "version")?.value;
	const skills = Object.getOwnPropertyDescriptor(value, "skills")?.value;
	if (version !== 1 || skills === null || typeof skills !== "object" || Array.isArray(skills)) {
		return false;
	}

	return Object.values(skills).every(isSkillLockEntry);
}

function isSkillLockEntry(value: unknown): value is SkillLockEntry {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const description = Object.getOwnPropertyDescriptor(value, "description")?.value;
	const frontmatter = Object.getOwnPropertyDescriptor(value, "frontmatter")?.value;
	const source = Object.getOwnPropertyDescriptor(value, "source")?.value;

	if (typeof description !== "string" || !isJsonRecord(frontmatter)) {
		return false;
	}
	if (source === null || typeof source !== "object" || Array.isArray(source)) {
		return false;
	}

	return (
		typeof Object.getOwnPropertyDescriptor(source, "repo")?.value === "string" &&
		typeof Object.getOwnPropertyDescriptor(source, "path")?.value === "string" &&
		typeof Object.getOwnPropertyDescriptor(source, "selector")?.value === "string"
	);
}
