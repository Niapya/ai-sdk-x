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
	createAt: number;
	description: string;
	keywords: string[];
	updateAt: number;
}

export interface MemoryIndex {
	daily: Record<string, Record<string, MemoryEntry>>;
	version: 1;
}
