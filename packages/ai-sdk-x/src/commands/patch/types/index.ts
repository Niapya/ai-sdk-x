export interface PatchCommandOptions {
	mountPoint: string;
}

export type Hunk = AddFileHunk | DeleteFileHunk | UpdateFileHunk;

export interface AddFileHunk {
	contents: string;
	path: string;
	type: "add";
}

export interface DeleteFileHunk {
	path: string;
	type: "delete";
}

export interface UpdateFileHunk {
	chunks: UpdateFileChunk[];
	movePath?: string;
	path: string;
	type: "update";
}

export interface UpdateFileChunk {
	changeContext?: string;
	isEndOfFile?: boolean;
	newLines: string[];
	oldLines: string[];
}

export interface ApplyPatchArgs {
	patch: string;
	hunks: Hunk[];
	workdir?: string;
}

export interface ApplyPatchFileUpdate {
	bom: boolean;
	content: string;
	unifiedDiff: string;
}
