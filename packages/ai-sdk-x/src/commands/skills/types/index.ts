import type { KVStorage } from "@/types/storage";
import type { JsonRecord } from "@/utils/json";

export interface SkillsCommandOptions {
	cache?: KVStorage;
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
