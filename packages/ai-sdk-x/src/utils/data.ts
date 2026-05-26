import {
	type BufferEncoding,
	type ByteString,
	type FileContent,
	type FsStat,
	type IFileSystem,
	unsafeBytesFromLatin1,
} from "just-bash";
import { descendantPrefix, normalizePath } from "./path";

/**
 * Directory entry shape used by wrapper filesystems when exposing typed listings.
 */
export interface FsDirent {
	name: string;
	isFile: boolean;
	isDirectory: boolean;
	isSymbolicLink: boolean;
}

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

/**
 * Check whether a path equals or is nested under another path.
 */
export function isSameOrDescendant(path: string, candidate: string): boolean {
	const normalizedPath = normalizePath(path);
	const normalizedCandidate = normalizePath(candidate);
	return (
		normalizedCandidate === normalizedPath ||
		normalizedCandidate.startsWith(descendantPrefix(normalizedPath))
	);
}

/**
 * Clone a byte array so cached and overlay reads do not share mutable buffers.
 */
export function cloneBytes(value: Uint8Array): Uint8Array {
	return new Uint8Array(value);
}

/**
 * Encode text or byte-like content into a raw Uint8Array.
 */
export function toBytes(content: FileContent, encoding?: BufferEncoding | null): Uint8Array {
	if (content instanceof Uint8Array) {
		return cloneBytes(content);
	}

	if (encoding === "base64") {
		return new Uint8Array(Buffer.from(content, "base64"));
	}
	if (encoding === "hex") {
		return new Uint8Array(Buffer.from(content, "hex"));
	}
	if (encoding === "binary" || encoding === "latin1") {
		return latin1ToBytes(content);
	}

	return textEncoder.encode(content);
}

/**
 * Decode a raw Uint8Array using the requested text or transfer encoding.
 */
export function decodeText(bytes: Uint8Array, encoding?: BufferEncoding | null): string {
	if (encoding === "base64") {
		return Buffer.from(bytes).toString("base64");
	}
	if (encoding === "hex") {
		return Buffer.from(bytes).toString("hex");
	}
	if (encoding === "binary" || encoding === "latin1") {
		return bytesToLatin1(bytes);
	}

	return textDecoder.decode(bytes);
}

/**
 * Serialize bytes as base64 for storage-friendly cache payloads.
 */
export function bytesToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString("base64");
}

/**
 * Deserialize a base64 payload back into raw bytes.
 */
export function base64ToBytes(value: string): Uint8Array {
	return new Uint8Array(Buffer.from(value, "base64"));
}

/**
 * Convert bytes to a latin1 string without interpreting them as UTF-8 text.
 */
export function bytesToLatin1(bytes: Uint8Array): string {
	let result = "";
	for (const byte of bytes) {
		result += String.fromCharCode(byte);
	}
	return result;
}

/**
 * Convert a latin1 byte string back into raw bytes.
 */
export function latin1ToBytes(value: string): Uint8Array {
	const bytes = new Uint8Array(value.length);
	for (let index = 0; index < value.length; index++) {
		bytes[index] = value.charCodeAt(index) & 0xff;
	}
	return bytes;
}

/**
 * Re-wrap raw bytes as just-bash ByteString values.
 */
export function toByteString(bytes: Uint8Array): ByteString {
	return unsafeBytesFromLatin1(bytesToLatin1(bytes));
}

/**
 * Convert a just-bash ByteString back into raw bytes.
 */
export function fromByteString(value: ByteString): Uint8Array {
	return latin1ToBytes(value as unknown as string);
}

/**
 * Read bytes from any filesystem, falling back to readFileBuffer when ByteString reads are unavailable.
 */
export async function readBytesFrom(fs: IFileSystem, path: string): Promise<Uint8Array> {
	if (fs.readFileBytes) {
		return fromByteString(await fs.readFileBytes(path));
	}

	return fs.readFileBuffer(path);
}

/**
 * Create a minimal FsStat object with sensible defaults.
 */
export function createStat(
	input: Partial<FsStat> & Pick<FsStat, "isFile" | "isDirectory" | "isSymbolicLink">,
): FsStat {
	return {
		mode: input.mode ?? (input.isDirectory ? 0o755 : 0o644),
		size: input.size ?? 0,
		mtime: input.mtime ?? new Date(),
		isFile: input.isFile,
		isDirectory: input.isDirectory,
		isSymbolicLink: input.isSymbolicLink,
	};
}

/**
 * Clone stat metadata while preserving Date object identity boundaries.
 */
export function cloneStat(stat: FsStat): FsStat {
	return {
		...stat,
		mtime: new Date(stat.mtime),
	};
}

/**
 * Convert FsStat into a JSON-safe structure for cache storage.
 */
export function serializeStat(stat: FsStat): SerializedStat {
	return {
		...stat,
		mtime: stat.mtime.toISOString(),
	};
}

/**
 * Restore a cached stat payload back into runtime FsStat shape.
 */
export function deserializeStat(stat: SerializedStat): FsStat {
	return {
		...stat,
		mtime: new Date(stat.mtime),
	};
}

/**
 * Detect common not-found filesystem errors.
 */
export function isNotFoundError(error: unknown): boolean {
	return error instanceof Error && /ENOENT|ENOTDIR/.test(error.message);
}

/**
 * Build a normalized ENOENT error for a filesystem operation.
 */
export function notFoundError(operation: string, path: string): Error {
	return new Error(`ENOENT: no such file or directory, ${operation} '${path}'`);
}

/**
 * Build an ENOTDIR error for a filesystem operation.
 */
export function notDirectoryError(operation: string, path: string): Error {
	return new Error(`ENOTDIR: not a directory, ${operation} '${path}'`);
}

/**
 * Build an EISDIR error for a filesystem operation.
 */
export function isDirectoryError(operation: string, path: string): Error {
	return new Error(`EISDIR: illegal operation on a directory, ${operation} '${path}'`);
}

/**
 * Build an ENOTEMPTY error for directory removals.
 */
export function directoryNotEmptyError(path: string): Error {
	return new Error(`ENOTEMPTY: directory not empty, rm '${path}'`);
}

/**
 * Build an EEXIST error for create-like operations.
 */
export function existsError(operation: string, path: string): Error {
	return new Error(`EEXIST: file already exists, ${operation} '${path}'`);
}

/**
 * Decode a raw buffer as UTF-8 text.
 */
export function decodeBuffer(buffer: Uint8Array): string {
	return textDecoder.decode(buffer);
}

export interface SerializedStat {
	isFile: boolean;
	isDirectory: boolean;
	isSymbolicLink: boolean;
	mode: number;
	size: number;
	mtime: string;
}
