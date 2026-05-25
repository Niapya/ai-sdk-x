import type { IFileSystem } from "just-bash";
import type { KVStorage } from "@/types/storage";

export interface MemoryOptions {
	cache?: KVStorage;
	fs?: IFileSystem;
	mountPoint?: string;
}

export interface MemoryConfig {
	readonly cache?: KVStorage;
	readonly enabled: boolean;
	readonly fs?: IFileSystem;
	readonly mountPoint: string;
}

export interface MemoryCommandOptions {
	cache?: KVStorage;
	mountPoint: string;
	now?: () => Date;
}
