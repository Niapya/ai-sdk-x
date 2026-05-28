import type { BashOptions, IFileSystem } from "just-bash";
import type { GitOptions } from "@/features/git/types";
import type { MemoryOptions } from "@/features/memory/types";
import type { PatchOptions } from "@/features/patch/types";
import type { SkillsOptions } from "@/features/skills/types";
import type { WorkspaceOptions } from "@/features/workspace/types";
import type { EnvBackend } from "@/runtime/env";
import type { ExecHook } from "@/types/feature";

export type { GitConfig, GitOptions } from "@/features/git/types";
export type { MemoryConfig, MemoryOptions } from "@/features/memory/types";
export type { PatchConfig, PatchOptions } from "@/features/patch/types";
export type { SkillsConfig, SkillsOptions } from "@/features/skills/types";
export type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";

export interface GetToolsOptions {
	description?: string;
	maxLines?: number;
	maxOutput?: number;
}

export interface XOptions {
	bash?: Omit<BashOptions, "customCommands" | "fs">;
	envBackend?: EnvBackend;
	execHooks?: ExecHook[];
	fs?: IFileSystem;
}

export interface DefaultFeatureOptions {
	git?: boolean | GitOptions;
	memory?: boolean | MemoryOptions;
	patch?: boolean | PatchOptions;
	skills?: boolean | SkillsOptions;
	workspace?: boolean | WorkspaceOptions;
}

export interface BashConfig extends Omit<BashOptions, "customCommands" | "fs"> {
	readonly cwd: string;
	readonly env: Record<string, string>;
	readonly javascript: NonNullable<BashOptions["javascript"]>;
	readonly python: NonNullable<BashOptions["python"]>;
}
