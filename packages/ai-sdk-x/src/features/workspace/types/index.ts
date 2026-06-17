import type { IFileSystem } from "just-bash";

export interface WorkspaceOptions {
	/**
	 * Filesystem mounted as the workspace root.
	 */
	fs?: IFileSystem;
	/**
	 * Path exposed to Bash as `$WORKSPACE_HOME`.
	 */
	mountPoint?: string;
	/**
	 * Whether to load a workspace-root agent instructions file into the
	 * environment instructions.
	 *
	 * Lookup order: `agents.md`, `agent.md`, then `claude.md`.
	 *
	 * @default true
	 */
	loadAgentsMd?: boolean;
	/**
	 * Maximum depth used when rendering the workspace tree in environment
	 * instructions.
	 *
	 * @default 5
	 */
	treeMaxDepth?: number;
}

export interface WorkspaceConfig {
	readonly enabled: boolean;
	readonly fs?: IFileSystem;
	readonly loadAgentsMd: boolean;
	readonly mountPoint: string;
	readonly treeMaxDepth: number;
}
