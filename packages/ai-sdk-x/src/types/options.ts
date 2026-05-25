import type { BashOptions, Command, IFileSystem } from "just-bash";
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

export interface BashConfig extends Omit<BashOptions, "customCommands" | "fs"> {
	readonly cwd: string;
	readonly env: Record<string, string>;
	readonly javascript: NonNullable<BashOptions["javascript"]>;
	readonly python: NonNullable<BashOptions["python"]>;
}

export interface WorkspaceConfig {
	readonly enabled: boolean;
	readonly fs?: IFileSystem;
	readonly mountPoint: string;
}

export interface SkillsConfig extends WorkspaceConfig {
	readonly cache?: KVStorage;
	readonly lockfile: boolean;
}

export interface MemoryConfig extends WorkspaceConfig {
	readonly cache?: KVStorage;
}

export interface XConfig {
	readonly bash: BashConfig;
	readonly memory: MemoryConfig;
	readonly skills: SkillsConfig;
	readonly workspace: WorkspaceConfig;
}

export interface XCommandMap {
	[name: string]: Command;
}

export interface DefaultXCommands extends XCommandMap {
	memory: Command;
	patch: Command;
	skills: Command;
}
