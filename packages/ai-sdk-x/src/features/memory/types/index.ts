import type { IFileSystem } from "just-bash";

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
