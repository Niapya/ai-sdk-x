import type { IFileSystem } from "just-bash";
import { z } from "zod";

export interface MemoryOptions {
	fs?: IFileSystem;
	mountPoint?: string;
}

export interface MemoryConfig {
	readonly enabled: boolean;
	readonly fs?: IFileSystem;
	readonly mountPoint: string;
}

export interface MemoryCommandOptions {
	mountPoint: string;
	now?: () => Date;
}

export interface MemoryEntry {
	category: string;
	createAt: number;
	description: string;
	keywords: string[];
	path: string;
	updateAt: number;
}

export interface MemoryIndex {
	categories: Record<string, Record<string, MemoryEntry>>;
	version: 1;
}

export const memoryEntrySchema = z.looseObject({
	category: z.string(),
	createAt: z.number(),
	description: z.string(),
	keywords: z.array(z.string()),
	path: z.string(),
	updateAt: z.number(),
});

export const memoryIndexSchema = z.looseObject({
	categories: z.record(z.string(), z.record(z.string(), memoryEntrySchema)),
	version: z.literal(1),
});
