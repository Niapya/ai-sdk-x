import type { IFileSystem } from "just-bash";

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

export interface SkillIndexEntry {
	createAt: number;
	description?: string;
	files: string[];
	frontmatter?: Record<string, string>;
	skillPath: string;
	updateAt: number;
	url?: string;
}

export interface SkillsIndex {
	skills: Record<string, SkillIndexEntry>;
	version: 1;
}
