import type { IFileSystem } from "just-bash";
import type { JsonRecord } from "@/utils/json";

export interface SkillsOptions {
	fs?: IFileSystem;
	lockfile?: boolean;
	mountPoint?: string;
}

export interface SkillsConfig {
	readonly enabled: boolean;
	readonly fs?: IFileSystem;
	readonly lockfile: boolean;
	readonly mountPoint: string;
}

export interface SkillsCommandOptions {
	lockfile: boolean;
	mountPoint: string;
}

export interface SkillInstallTarget {
	repoUrl: string;
	selector: string;
}

export interface SkillLockEntry {
	description: string;
	frontmatter: JsonRecord;
	source: {
		path: string;
		repo: string;
		selector: string;
	};
}

export interface SkillsLockfile {
	skills: Record<string, SkillLockEntry>;
	version: 1;
}
