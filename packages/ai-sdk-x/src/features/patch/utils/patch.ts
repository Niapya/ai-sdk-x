import { deriveNewContentsFromChunks } from "@/features/patch/utils/apply";
import { parsePatch } from "@/features/patch/utils/parser";
import type { Hunk } from "@/features/patch/utils/types";

export function patch(oldString: string, patchText: string): string {
	let hunks: Hunk[];
	try {
		hunks = parsePatch(patchText).hunks;
	} catch (error) {
		throw new Error(`apply_patch verification failed: ${error}`);
	}

	if (hunks.length === 0) {
		const normalized = patchText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
		if (normalized === "*** Begin Patch\n*** End Patch") {
			throw new Error("patch rejected: empty patch");
		}
		throw new Error("apply_patch verification failed: no hunks found");
	}

	let content = oldString;
	for (const hunk of hunks) {
		switch (hunk.type) {
			case "add": {
				const newContent =
					hunk.contents.length === 0 || hunk.contents.endsWith("\n")
						? hunk.contents
						: `${hunk.contents}\n`;
				content = splitBom(newContent).text;
				break;
			}
			case "delete": {
				content = "";
				break;
			}
			case "update": {
				try {
					content = deriveNewContentsFromChunks(hunk.path, hunk.chunks, content).content;
				} catch (error) {
					throw new Error(`apply_patch verification failed: ${error}`);
				}
				break;
			}
		}
	}

	return content;
}

function splitBom(content: string): { text: string; bom: boolean } {
	if (content.charCodeAt(0) === 0xfeff) {
		return { text: content.slice(1), bom: true };
	}
	return { text: content, bom: false };
}

export { deriveNewContentsFromChunks } from "@/features/patch/utils/apply";
export { parsePatch } from "@/features/patch/utils/parser";
export type {
	ApplyPatchArgs,
	ApplyPatchFileUpdate,
	Hunk,
	UpdateFileChunk,
} from "@/features/patch/utils/types";
