import type { BashOptions, IFileSystem } from "just-bash";
import type { KVStorage } from "@/types/storage";

export interface WorkspaceOptions {
	fs?: IFileSystem;
	mountPoint?: string;
}

export interface SkillsOptions {
	cache?: KVStorage;
	fs?: IFileSystem;
	lockfile?: boolean;
	mountPoint?: string;
}

export interface MemoryOptions {
	cache?: KVStorage;
	fs?: IFileSystem;
	mountPoint?: string;
}

export interface XOptions {
	bash?: Omit<BashOptions, "customCommands" | "fs">;
	fs?: IFileSystem;
	memory?: boolean | MemoryOptions;
	skills?: boolean | SkillsOptions;
	workspace?: boolean | WorkspaceOptions;
}

export interface ResolvedEnvironmentOptions {
	memoryMount: string;
	skillsLockfile: boolean;
	skillsMount: string;
	workspaceMount: string;
}
