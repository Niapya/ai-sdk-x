import type { Hunk, UpdateFileChunk } from "@/features/patch/types";
import { normalizeNewlines, stripHeredoc } from "@/utils/text";

const BEGIN_PATCH_MARKER = "*** Begin Patch";
const END_PATCH_MARKER = "*** End Patch";
const ADD_FILE_MARKER = "*** Add File:";
const DELETE_FILE_MARKER = "*** Delete File:";
const UPDATE_FILE_MARKER = "*** Update File:";
const MOVE_TO_MARKER = "*** Move to:";
const END_OF_FILE_MARKER = "*** End of File";

type FileHeader =
	| { filePath: string; lineNumber: number; type: "add" | "delete" }
	| { filePath: string; lineNumber: number; movePath?: string; nextIndex: number; type: "update" };

interface PatchLine {
	number: number;
	text: string;
}

export class PatchParseError extends Error {
	readonly lineNumber?: number;

	constructor(message: string, lineNumber?: number, scope: "hunk" | "patch" = "hunk") {
		super(
			lineNumber === undefined
				? message
				: `Invalid patch ${scope === "hunk" ? "hunk " : ""}on line ${lineNumber}: ${message}`,
		);
		this.name = "PatchParseError";
		this.lineNumber = lineNumber;
	}
}

export function parsePatch(patchText: string): { hunks: Hunk[] } {
	const lines = toPatchLines(patchText);
	const { beginIndex, endIndex } = findPatchBoundaries(lines);
	const hunks: Hunk[] = [];
	let index = beginIndex + 1;

	while (index < endIndex) {
		const line = lines[index];
		const trimmed = line.text.trim();

		if (!trimmed) {
			index++;
			continue;
		}

		const header = parseFileHeader(lines, index, endIndex);
		if (!header) {
			throw invalidHunkHeader(line);
		}

		switch (header.type) {
			case "add": {
				const { content, nextIndex } = parseAddFileContent(lines, index + 1, endIndex);
				hunks.push({ type: "add", path: header.filePath, contents: content });
				index = nextIndex;
				break;
			}

			case "delete":
				hunks.push({ type: "delete", path: header.filePath });
				index++;
				break;

			case "update": {
				const { chunks, nextIndex } = parseUpdateFileChunks(lines, header.nextIndex, endIndex);
				if (chunks.length === 0) {
					throw new PatchParseError(
						`Update file hunk for path '${header.filePath}' is empty`,
						header.lineNumber,
					);
				}
				hunks.push({
					type: "update",
					path: header.filePath,
					movePath: header.movePath,
					chunks,
				});
				index = nextIndex;
				break;
			}
		}
	}

	return { hunks };
}

function toPatchLines(patchText: string): PatchLine[] {
	const cleaned = normalizeNewlines(stripHeredoc(patchText.trim()));
	return cleaned.split("\n").map((text, index) => ({ text, number: index + 1 }));
}

function findPatchBoundaries(lines: PatchLine[]): { beginIndex: number; endIndex: number } {
	const beginIndex = lines.findIndex((line) => line.text.trim() === BEGIN_PATCH_MARKER);

	if (beginIndex === -1) {
		throw new PatchParseError(
			"The first patch marker must be '*** Begin Patch'",
			firstContentLine(lines),
			"patch",
		);
	}

	const endIndex = lines.findIndex(
		(line, index) => index > beginIndex && line.text.trim() === END_PATCH_MARKER,
	);

	if (endIndex === -1) {
		throw new PatchParseError(
			"The last patch marker must be '*** End Patch'",
			lines[lines.length - 1]?.number,
			"patch",
		);
	}

	if (endIndex <= beginIndex) {
		throw new PatchParseError(
			"Invalid patch format: End marker appears before Begin marker",
			lines[endIndex]?.number,
			"patch",
		);
	}

	for (let index = 0; index < beginIndex; index++) {
		if (lines[index].text.trim()) {
			throw new PatchParseError(
				"The first non-empty line of the patch must be '*** Begin Patch'",
				lines[index].number,
				"patch",
			);
		}
	}

	for (let index = endIndex + 1; index < lines.length; index++) {
		if (lines[index].text.trim()) {
			throw new PatchParseError(
				"No non-empty content is allowed after '*** End Patch'",
				lines[index].number,
				"patch",
			);
		}
	}

	return { beginIndex, endIndex };
}

function parseFileHeader(lines: PatchLine[], index: number, endIndex: number): FileHeader | null {
	const line = lines[index];
	const trimmed = line.text.trim();

	if (trimmed.startsWith(ADD_FILE_MARKER)) {
		const filePath = parsePathAfterMarker(trimmed, ADD_FILE_MARKER, line.number);
		return { type: "add", filePath, lineNumber: line.number };
	}

	if (trimmed.startsWith(DELETE_FILE_MARKER)) {
		const filePath = parsePathAfterMarker(trimmed, DELETE_FILE_MARKER, line.number);
		return { type: "delete", filePath, lineNumber: line.number };
	}

	if (!trimmed.startsWith(UPDATE_FILE_MARKER)) {
		return null;
	}

	const filePath = parsePathAfterMarker(trimmed, UPDATE_FILE_MARKER, line.number);
	let nextIndex = index + 1;
	let movePath: string | undefined;

	while (nextIndex < endIndex && !lines[nextIndex].text.trim()) {
		nextIndex++;
	}

	if (nextIndex < endIndex && lines[nextIndex].text.trim().startsWith(MOVE_TO_MARKER)) {
		movePath = parsePathAfterMarker(
			lines[nextIndex].text.trim(),
			MOVE_TO_MARKER,
			lines[nextIndex].number,
		);
		nextIndex++;
	}

	return { type: "update", filePath, movePath, nextIndex, lineNumber: line.number };
}

function parsePathAfterMarker(line: string, marker: string, lineNumber: number): string {
	const path = line.slice(marker.length).trim();
	if (!path) {
		throw new PatchParseError(`Missing path after '${marker}'`, lineNumber);
	}
	return path;
}

function parseAddFileContent(
	lines: PatchLine[],
	startIndex: number,
	endIndex: number,
): { content: string; nextIndex: number } {
	const content: string[] = [];
	let index = startIndex;

	while (index < endIndex) {
		const line = lines[index];
		const trimmed = line.text.trim();

		if (isFileOperationHeader(trimmed)) {
			break;
		}

		if (!trimmed) {
			content.push("");
			index++;
			continue;
		}

		const markerIndex = firstNonWhitespaceIndex(line.text);
		if (line.text[markerIndex] !== "+") {
			throw new PatchParseError(
				"Add file lines must start with '+', or start the next file operation",
				line.number,
			);
		}

		content.push(line.text.slice(markerIndex + 1));
		index++;
	}

	return { content: content.join("\n"), nextIndex: index };
}

function parseUpdateFileChunks(
	lines: PatchLine[],
	startIndex: number,
	endIndex: number,
): { chunks: UpdateFileChunk[]; nextIndex: number } {
	const chunks: UpdateFileChunk[] = [];
	let index = startIndex;
	let allowMissingContext = true;

	while (index < endIndex) {
		const line = lines[index];
		const trimmed = line.text.trim();

		if (!trimmed) {
			index++;
			continue;
		}

		if (isFileOperationHeader(trimmed)) {
			break;
		}

		const chunk = parseUpdateFileChunk(lines, index, endIndex, allowMissingContext);
		chunks.push(chunk.chunk);
		index = chunk.nextIndex;
		allowMissingContext = false;
	}

	return { chunks, nextIndex: index };
}

function parseUpdateFileChunk(
	lines: PatchLine[],
	startIndex: number,
	endIndex: number,
	allowMissingContext: boolean,
): { chunk: UpdateFileChunk; nextIndex: number } {
	let index = startIndex;
	let changeContext: string | undefined;
	const first = lines[index];
	const firstTrimmed = first.text.trim();

	if (firstTrimmed === "@@") {
		index++;
	} else if (firstTrimmed.startsWith("@@")) {
		changeContext = firstTrimmed.slice(2).trim() || undefined;
		index++;
	} else if (!allowMissingContext) {
		throw new PatchParseError(
			`Expected update hunk to start with '@@', got '${firstTrimmed}'`,
			first.number,
		);
	}

	const oldLines: string[] = [];
	const newLines: string[] = [];
	let isEndOfFile = false;
	let parsedChangeLines = 0;

	while (index < endIndex) {
		const line = lines[index];
		const trimmed = line.text.trim();

		if (trimmed === END_OF_FILE_MARKER) {
			if (parsedChangeLines === 0) {
				throw new PatchParseError("Update hunk does not contain any change lines", line.number);
			}
			isEndOfFile = true;
			index++;
			break;
		}

		if (trimmed.startsWith("@@") || isFileOperationHeader(trimmed)) {
			break;
		}

		if (!trimmed) {
			oldLines.push("");
			newLines.push("");
			parsedChangeLines++;
			index++;
			continue;
		}

		const { marker, value } = parseChangeLinePrefix(line.text);

		if (marker === " ") {
			oldLines.push(value);
			newLines.push(value);
		} else if (marker === "-") {
			oldLines.push(value);
		} else if (marker === "+") {
			newLines.push(value);
		} else {
			throw new PatchParseError(
				`Unexpected line in update hunk: '${trimmed}'. Lines must start with ' ', '+', '-', '@@', or a file operation header`,
				line.number,
			);
		}

		parsedChangeLines++;
		index++;
	}

	if (parsedChangeLines === 0) {
		throw new PatchParseError("Update hunk does not contain any change lines", first.number);
	}

	return {
		chunk: {
			oldLines,
			newLines,
			changeContext,
			isEndOfFile: isEndOfFile || undefined,
		},
		nextIndex: index,
	};
}

function isFileOperationHeader(trimmedLine: string): boolean {
	return (
		trimmedLine.startsWith(ADD_FILE_MARKER) ||
		trimmedLine.startsWith(DELETE_FILE_MARKER) ||
		trimmedLine.startsWith(UPDATE_FILE_MARKER)
	);
}

function invalidHunkHeader(line: PatchLine): PatchParseError {
	return new PatchParseError(
		`'${line.text.trim()}' is not a valid hunk header. Valid hunk headers: '*** Add File: {path}', '*** Delete File: {path}', '*** Update File: {path}'`,
		line.number,
	);
}

function firstContentLine(lines: PatchLine[]): number | undefined {
	return lines.find((line) => line.text.trim())?.number ?? lines[0]?.number;
}

function parseChangeLinePrefix(text: string): { marker: string; value: string } {
	const first = text[0];
	if (first === " " || first === "+" || first === "-") {
		return { marker: first, value: text.slice(1) };
	}

	const markerIndex = firstNonWhitespaceIndex(text);
	const marker = text[markerIndex];
	if (marker === "+" || marker === "-") {
		return { marker, value: text.slice(markerIndex + 1) };
	}

	return { marker: first ?? "", value: text.slice(1) };
}

function firstNonWhitespaceIndex(value: string): number {
	const match = value.match(/\S/);
	return match?.index ?? 0;
}
