import type { BashOptions, IFileSystem } from "just-bash";
import type { GitOptions } from "@/features/git/types";
import type { MemoryOptions } from "@/features/memory/types";
import type { PatchOptions } from "@/features/patch/types";
import type { SkillsOptions } from "@/features/skills/types";
import type { WorkspaceOptions } from "@/features/workspace/types";
import type { BashApprovalOptions } from "@/runtime/approval";
import type { EnvBackend } from "@/runtime/env";
import type { ExecHook } from "@/types/feature";

export type { GitConfig, GitOptions } from "@/features/git/types";
export type { MemoryConfig, MemoryOptions } from "@/features/memory/types";
export type { PatchConfig, PatchOptions } from "@/features/patch/types";
export type { SkillsConfig, SkillsOptions } from "@/features/skills/types";
export type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";

export interface GetToolsOptions {
	/**
	 * Additional instructions appended to the generated Bash tool description.
	 */
	externalDescription?: string;
	/**
	 * Whether `getTools()` should embed the full generated Bash description in the tool metadata.
	 * Set this to false when you add `await x.getInstructions()` to your model System Prompt instead.
	 */
	enableDescription?: boolean;
	/**
	 * Command-level approval rules for the Bash tool exposed through `getTools()`.
	 *
	 * Policy order is: omitted approval allows all tool calls; dynamic commands use
	 * `dynamicAction`; static commands use matching `rules`; unmatched static commands
	 * use `defaultAction`.
	 *
	 * Direct `x.exec()` calls are application-owned and do not use these rules.
	 */
	approval?: BashApprovalOptions;
	maxLines?: number;
	maxOutput?: number;
}

export interface Instructions {
	guidance: string;
	environment: string;
}

export type XBashOptions = Omit<BashOptions, "customCommands" | "fs" | "network"> & {
	network?: BashOptions["network"] | false;
};

export interface XOptions {
	bash?: XBashOptions;
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

export interface BashConfig extends Omit<BashOptions, "customCommands" | "fs" | "network"> {
	readonly cwd: string;
	readonly env: Record<string, string>;
	readonly javascript: NonNullable<BashOptions["javascript"]>;
	readonly network?: BashOptions["network"] | false;
	readonly python: NonNullable<BashOptions["python"]>;
}
