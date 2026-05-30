export { deriveNewContentsFromChunks } from "./apply";
export { createPatchCommand } from "./command";
export { createPatchFeatureDescription } from "./description";
export { parsePatch } from "./parser";
export { patch } from "./patch";
export { normalizeNewlines, stripHeredoc, toErrorMessage } from "./shared";
export type { ApplyPatchArgs, ApplyPatchFileUpdate, Hunk, UpdateFileChunk } from "./types";
