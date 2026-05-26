import type { GitOptions as JustGitOptions } from "just-git";

export type GitOptions = Omit<JustGitOptions, "cwd" | "fs" | "gitDir" | "objectStore" | "refStore">;

export interface GitConfig extends GitOptions {
	readonly enabled: boolean;
}
