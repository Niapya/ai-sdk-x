import type { IFileSystem } from "just-bash";
import { z } from "zod";

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
	sourcePath?: string;
}

export interface SkillIndexEntry {
	createAt: number;
	description?: string;
	files: string[];
	frontmatter?: Record<string, string>;
	skillPath: string;
	source?: "git" | "local";
	sourcePath?: string;
	updateAt: number;
	url?: string;
}

export interface SkillsIndex {
	skills: Record<string, SkillIndexEntry>;
	version: 1;
}

export const skillIndexEntrySchema: z.ZodType<SkillIndexEntry> = z.looseObject({
	createAt: z.number(),
	description: z.string().optional(),
	files: z.array(z.string()),
	frontmatter: z.record(z.string(), z.string()).optional(),
	skillPath: z.string(),
	source: z.enum(["git", "local"]).optional(),
	sourcePath: z.string().optional(),
	updateAt: z.number(),
	url: z.string().optional(),
});

export const skillsIndexSchema: z.ZodType<SkillsIndex> = z.looseObject({
	skills: z.record(z.string(), skillIndexEntrySchema),
	version: z.literal(1),
});
