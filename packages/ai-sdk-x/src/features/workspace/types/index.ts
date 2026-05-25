import type { IFileSystem } from "just-bash";

export interface WorkspaceOptions {
	fs?: IFileSystem;
	mountPoint?: string;
}

export interface WorkspaceConfig {
	readonly enabled: boolean;
	readonly fs?: IFileSystem;
	readonly mountPoint: string;
}
