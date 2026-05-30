export interface ApplyPatchArgs {
	patch: string;
	hunks: Hunk[];
	workdir?: string;
}

export type Hunk =
	| { type: "add"; path: string; contents: string }
	| { type: "delete"; path: string }
	| { type: "update"; path: string; move_path?: string; chunks: UpdateFileChunk[] };

export interface UpdateFileChunk {
	old_lines: string[];
	new_lines: string[];
	change_context?: string;
	is_end_of_file?: boolean;
}

export interface ApplyPatchFileUpdate {
	unified_diff: string;
	content: string;
	bom: boolean;
}
