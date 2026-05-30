import type { ApplyPatchFileUpdate, UpdateFileChunk } from "@/features/patch/types";

export function deriveNewContentsFromChunks(
	filePath: string,
	chunks: UpdateFileChunk[],
	originalText: string,
): ApplyPatchFileUpdate {
	const originalContent = splitBom(originalText);
	const originalLines = originalContent.text.split("\n");

	if (originalLines.length > 0 && originalLines[originalLines.length - 1] === "") {
		originalLines.pop();
	}

	const replacements = computeReplacements(originalLines, filePath, chunks);
	const newLines = applyReplacements(originalLines, replacements);

	if (newLines.length === 0 || newLines[newLines.length - 1] !== "") {
		newLines.push("");
	}

	const next = splitBom(newLines.join("\n"));
	const newContent = next.text;
	const unifiedDiff = generateUnifiedDiff(originalContent.text, newContent);

	return {
		unifiedDiff,
		content: newContent,
		bom: originalContent.bom || next.bom,
	};
}

function computeReplacements(
	originalLines: string[],
	filePath: string,
	chunks: UpdateFileChunk[],
): Array<[number, number, string[]]> {
	const replacements: Array<[number, number, string[]]> = [];
	let lineIndex = 0;

	for (const chunk of chunks) {
		if (chunk.changeContext) {
			const contextIdx = seekSequence(originalLines, [chunk.changeContext], lineIndex);
			if (contextIdx === -1) {
				throw new Error(`Failed to find context '${chunk.changeContext}' in ${filePath}`);
			}
			lineIndex = contextIdx + 1;
		}

		if (chunk.oldLines.length === 0) {
			const insertionIdx =
				originalLines.length > 0 && originalLines[originalLines.length - 1] === ""
					? originalLines.length - 1
					: originalLines.length;
			replacements.push([insertionIdx, 0, chunk.newLines]);
			continue;
		}

		let pattern = chunk.oldLines;
		let newSlice = chunk.newLines;
		let found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile);

		if (found === -1 && pattern.length > 0 && pattern[pattern.length - 1] === "") {
			pattern = pattern.slice(0, -1);
			if (newSlice.length > 0 && newSlice[newSlice.length - 1] === "") {
				newSlice = newSlice.slice(0, -1);
			}
			found = seekSequence(originalLines, pattern, lineIndex, chunk.isEndOfFile);
		}

		if (found !== -1) {
			replacements.push([found, pattern.length, newSlice]);
			lineIndex = found + pattern.length;
		} else {
			throw new Error(
				`Failed to find expected lines in ${filePath}:\n${chunk.oldLines.join("\n")}`,
			);
		}
	}

	replacements.sort((a, b) => a[0] - b[0]);

	return replacements;
}

function applyReplacements(
	lines: string[],
	replacements: Array<[number, number, string[]]>,
): string[] {
	const result = [...lines];

	for (let i = replacements.length - 1; i >= 0; i--) {
		const [startIdx, oldLen, newSegment] = replacements[i];
		result.splice(startIdx, oldLen);

		for (let j = 0; j < newSegment.length; j++) {
			result.splice(startIdx + j, 0, newSegment[j]);
		}
	}

	return result;
}

function normalizeUnicode(str: string): string {
	return str
		.replace(/[‘’‚‛]/g, "'")
		.replace(/[“”„‟]/g, '"')
		.replace(/[‐‑‒–—―]/g, "-")
		.replace(/…/g, "...")
		.replace(/ /g, " ");
}

type Comparator = (a: string, b: string) => boolean;

function tryMatch(
	lines: string[],
	pattern: string[],
	startIndex: number,
	compare: Comparator,
	eof: boolean,
): number {
	if (eof) {
		const fromEnd = lines.length - pattern.length;
		if (fromEnd >= startIndex) {
			let matches = true;
			for (let j = 0; j < pattern.length; j++) {
				if (!compare(lines[fromEnd + j], pattern[j])) {
					matches = false;
					break;
				}
			}
			if (matches) return fromEnd;
		}
	}

	for (let i = startIndex; i <= lines.length - pattern.length; i++) {
		let matches = true;
		for (let j = 0; j < pattern.length; j++) {
			if (!compare(lines[i + j], pattern[j])) {
				matches = false;
				break;
			}
		}
		if (matches) return i;
	}

	return -1;
}

function seekSequence(lines: string[], pattern: string[], startIndex: number, eof = false): number {
	if (pattern.length === 0) return -1;

	const exact = tryMatch(lines, pattern, startIndex, (a, b) => a === b, eof);
	if (exact !== -1) return exact;

	const rstrip = tryMatch(lines, pattern, startIndex, (a, b) => a.trimEnd() === b.trimEnd(), eof);
	if (rstrip !== -1) return rstrip;

	const trim = tryMatch(lines, pattern, startIndex, (a, b) => a.trim() === b.trim(), eof);
	if (trim !== -1) return trim;

	return tryMatch(
		lines,
		pattern,
		startIndex,
		(a, b) => normalizeUnicode(a.trim()) === normalizeUnicode(b.trim()),
		eof,
	);
}

function generateUnifiedDiff(oldContent: string, newContent: string): string {
	const oldLines = oldContent.split("\n");
	const newLines = newContent.split("\n");
	let diff = "@@ -1 +1 @@\n";
	const maxLen = Math.max(oldLines.length, newLines.length);
	let hasChanges = false;

	for (let i = 0; i < maxLen; i++) {
		const oldLine = oldLines[i] || "";
		const newLine = newLines[i] || "";

		if (oldLine !== newLine) {
			if (oldLine) diff += `-${oldLine}\n`;
			if (newLine) diff += `+${newLine}\n`;
			hasChanges = true;
		} else if (oldLine) {
			diff += ` ${oldLine}\n`;
		}
	}

	return hasChanges ? diff : "";
}

function splitBom(content: string): { text: string; bom: boolean } {
	if (content.charCodeAt(0) === 0xfeff) {
		return { text: content.slice(1), bom: true };
	}
	return { text: content, bom: false };
}
