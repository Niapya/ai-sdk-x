import type {
	ByteString,
	CpOptions,
	FileContent,
	FsStat,
	IFileSystem,
	MkdirOptions,
	RmOptions,
} from "just-bash";
import { InMemoryKVStore } from "@/runtime/storage/in-memory-kv-store";
import type { KVStorage } from "@/types/storage";
import {
	base64ToBytes,
	bytesToBase64,
	deserializeStat,
	type FsDirent,
	isNotFoundError,
	readBytesFrom,
	serializeStat,
	toByteString,
} from "@/utils/data";
import { descendantPrefix, joinPath, normalizePath, parentPaths, resolvePath } from "@/utils/path";

type ReadFileOptions = Parameters<IFileSystem["readFile"]>[1];
type WriteFileOptions = Parameters<IFileSystem["writeFile"]>[2];

type CacheEnvelope =
	| { expiresAt: null | number; kind: "dir"; value: string[] }
	| { expiresAt: null | number; kind: "dirents"; value: FsDirent[] }
	| { expiresAt: null | number; kind: "negative"; message: string }
	| { expiresAt: null | number; kind: "stat"; value: ReturnType<typeof serializeStat> }
	| { expiresAt: null | number; kind: "text"; value: string }
	| { expiresAt: null | number; kind: "bytes"; value: string };

type PositiveCacheEnvelope = Exclude<CacheEnvelope, { kind: "negative" }>;

type CacheKeyKind =
	| "readFile"
	| "readFileBuffer"
	| "readFileBytes"
	| "stat"
	| "readdir"
	| "readdirWithFileTypes";

interface CacheRecord {
	kind: CacheKeyKind;
	path: string;
	size: number;
	writtenAt: number;
}

interface CacheIndexRecord {
	kind: CacheKeyKind;
	path: string;
	size: number;
}

/**
 * Configuration for the read-through caching filesystem wrapper.
 */
export interface CachingFsOptions {
	cache?: KVStorage;
	fs: IFileSystem;
	maxBytes?: number;
	negativeTtlMs?: number;
	now?: () => number;
	readFileTtlMs?: number;
	readdirTtlMs?: number;
	readdirWithFileTypesTtlMs?: number;
	readFileBufferTtlMs?: number;
	readFileBytesTtlMs?: number;
	statTtlMs?: number;
	ttlMs?: number;
}

/**
 * Read-through filesystem cache for remote or high-latency backends.
 *
 * The wrapper caches readFile, readFileBuffer, readFileBytes, stat, readdir,
 * and readdirWithFileTypes results, then invalidates affected entries on
 * mutations so readers do not observe stale directory or file metadata.
 */
export class CachingFs implements IFileSystem {
	private readonly cache: KVStorage;
	private readonly fs: IFileSystem;
	private readonly keyPrefix: string;
	private readonly maxBytes: number;
	private readonly metadata = new Map<string, CacheRecord>();
	private readonly negativeTtlMs: number;
	private readonly now: () => number;
	private readonly ttlByKind: Record<CacheKeyKind, number>;

	constructor(options: CachingFsOptions) {
		this.fs = options.fs;
		this.cache = options.cache ?? new InMemoryKVStore();
		this.keyPrefix = "runtime-storage";
		this.maxBytes = options.maxBytes ?? Number.POSITIVE_INFINITY;
		this.negativeTtlMs = options.negativeTtlMs ?? 5_000;
		this.now = options.now ?? Date.now;
		this.ttlByKind = {
			readFile: options.readFileTtlMs ?? options.ttlMs ?? 30_000,
			readFileBuffer: options.readFileBufferTtlMs ?? options.ttlMs ?? 30_000,
			readFileBytes: options.readFileBytesTtlMs ?? options.ttlMs ?? 30_000,
			stat: options.statTtlMs ?? options.ttlMs ?? 30_000,
			readdir: options.readdirTtlMs ?? options.ttlMs ?? 30_000,
			readdirWithFileTypes: options.readdirWithFileTypesTtlMs ?? options.ttlMs ?? 30_000,
		};
	}

	async readFile(path: string, options?: ReadFileOptions): Promise<string> {
		const normalized = normalizePath(path);
		const encoding = typeof options === "string" ? options : (options?.encoding ?? "utf8");
		const key = this.key("readFile", normalized, encoding);
		const cached = await this.readCache(key);
		if (cached?.kind === "text") {
			return cached.value;
		}

		return this.remember(key, normalized, "readFile", async () => ({
			kind: "text",
			value: await this.fs.readFile(normalized, options),
		}));
	}

	async readFileBytes(path: string): Promise<ByteString> {
		const normalized = normalizePath(path);
		const key = this.key("readFileBytes", normalized);
		const cached = await this.readCache(key);
		if (cached?.kind === "bytes") {
			return toByteString(base64ToBytes(cached.value));
		}

		const value = await this.remember(key, normalized, "readFileBytes", async () => ({
			kind: "bytes",
			value: bytesToBase64(await readBytesFrom(this.fs, normalized)),
		}));
		return toByteString(base64ToBytes(value));
	}

	async readFileBuffer(path: string): Promise<Uint8Array> {
		const normalized = normalizePath(path);
		const key = this.key("readFileBuffer", normalized);
		const cached = await this.readCache(key);
		if (cached?.kind === "bytes") {
			return base64ToBytes(cached.value);
		}

		const value = await this.remember(key, normalized, "readFileBuffer", async () => ({
			kind: "bytes",
			value: bytesToBase64(await this.fs.readFileBuffer(normalized)),
		}));
		return base64ToBytes(value);
	}

	async writeFile(path: string, content: FileContent, options?: WriteFileOptions): Promise<void> {
		const normalized = normalizePath(path);
		await this.fs.writeFile(normalized, content, options);
		await this.invalidateForMutation(normalized);
	}

	async appendFile(path: string, content: FileContent, options?: WriteFileOptions): Promise<void> {
		const normalized = normalizePath(path);
		await this.fs.appendFile(normalized, content, options);
		await this.invalidateForMutation(normalized);
	}

	async exists(path: string): Promise<boolean> {
		try {
			await this.stat(path);
			return true;
		} catch (error) {
			if (isNotFoundError(error)) {
				return false;
			}
			throw error;
		}
	}

	async stat(path: string): Promise<FsStat> {
		const normalized = normalizePath(path);
		const key = this.key("stat", normalized);
		const cached = await this.readCache(key);
		if (cached?.kind === "stat") {
			return deserializeStat(cached.value);
		}

		const value = await this.remember(key, normalized, "stat", async () => ({
			kind: "stat",
			value: serializeStat(await this.fs.stat(normalized)),
		}));
		return deserializeStat(value);
	}

	async mkdir(path: string, options?: MkdirOptions): Promise<void> {
		const normalized = normalizePath(path);
		await this.fs.mkdir(normalized, options);
		await this.invalidateForMutation(normalized);
	}

	async readdir(path: string): Promise<string[]> {
		const normalized = normalizePath(path);
		const key = this.key("readdir", normalized);
		const cached = await this.readCache(key);
		if (cached?.kind === "dir") {
			return [...cached.value];
		}

		return this.remember(key, normalized, "readdir", async () => ({
			kind: "dir",
			value: await this.fs.readdir(normalized),
		}));
	}

	async readdirWithFileTypes(path: string): Promise<FsDirent[]> {
		const normalized = normalizePath(path);
		const key = this.key("readdirWithFileTypes", normalized);
		const cached = await this.readCache(key);
		if (cached?.kind === "dirents") {
			return cached.value.map((entry) => ({ ...entry }));
		}

		return this.remember(key, normalized, "readdirWithFileTypes", async () => ({
			kind: "dirents",
			value: this.fs.readdirWithFileTypes
				? (await this.fs.readdirWithFileTypes(normalized)).map((entry) => ({ ...entry }))
				: await this.readDirentsFromStats(normalized),
		}));
	}

	async rm(path: string, options?: RmOptions): Promise<void> {
		const normalized = normalizePath(path);
		await this.fs.rm(normalized, options);
		await this.invalidateForMutation(normalized);
	}

	async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
		const srcPath = normalizePath(src);
		const destPath = normalizePath(dest);
		await this.fs.cp(srcPath, destPath, options);
		await this.invalidateForMutation(srcPath);
		await this.invalidateForMutation(destPath);
	}

	async mv(src: string, dest: string): Promise<void> {
		const srcPath = normalizePath(src);
		const destPath = normalizePath(dest);
		await this.fs.mv(srcPath, destPath);
		await this.invalidateForMutation(srcPath);
		await this.invalidateForMutation(destPath);
	}

	resolvePath(base: string, path: string): string {
		return resolvePath(base, path);
	}

	getAllPaths(): string[] {
		return this.fs.getAllPaths();
	}

	async chmod(path: string, mode: number): Promise<void> {
		const normalized = normalizePath(path);
		await this.fs.chmod(normalized, mode);
		await this.invalidateForMutation(normalized);
	}

	async symlink(target: string, linkPath: string): Promise<void> {
		const normalized = normalizePath(linkPath);
		await this.fs.symlink(target, normalized);
		await this.invalidateForMutation(normalized);
	}

	async link(existingPath: string, newPath: string): Promise<void> {
		const normalized = normalizePath(newPath);
		await this.fs.link(existingPath, normalized);
		await this.invalidateForMutation(normalized);
	}

	async readlink(path: string): Promise<string> {
		return this.fs.readlink(normalizePath(path));
	}

	async lstat(path: string): Promise<FsStat> {
		return this.fs.lstat(normalizePath(path));
	}

	async realpath(path: string): Promise<string> {
		return this.fs.realpath(normalizePath(path));
	}

	async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
		const normalized = normalizePath(path);
		await this.fs.utimes(normalized, atime, mtime);
		await this.invalidateForMutation(normalized);
	}

	private async readDirentsFromStats(path: string): Promise<FsDirent[]> {
		const entries = await this.fs.readdir(path);
		return Promise.all(
			entries.map(async (name) => {
				const stat = await this.fs.lstat(joinPath(path, name));
				return {
					name,
					isFile: stat.isFile,
					isDirectory: stat.isDirectory,
					isSymbolicLink: stat.isSymbolicLink,
				};
			}),
		);
	}

	private key(kind: CacheKeyKind, path: string, suffix?: string): string {
		return `${this.keyPrefix}:${kind}:${path}${suffix ? `:${suffix}` : ""}`;
	}

	private async readCache(key: string): Promise<CacheEnvelope | null> {
		const raw = await this.cache.get(key);
		if (!raw) {
			return null;
		}

		const entry = JSON.parse(raw) as CacheEnvelope;
		if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
			await this.deleteKey(key);
			return null;
		}

		if (entry.kind === "negative") {
			throw new Error(entry.message);
		}

		return entry;
	}

	private async remember<T>(
		key: string,
		path: string,
		kind: CacheKeyKind,
		loader: () => Promise<Omit<PositiveCacheEnvelope, "expiresAt"> & { value: T }>,
	): Promise<T> {
		try {
			const entry = await loader();
			// The cached payload kind is determined by the loader branch above.
			const envelope = {
				...entry,
				expiresAt: this.now() + this.ttlByKind[kind],
			} as CacheEnvelope;
			await this.writeCache(key, path, kind, envelope);
			return entry.value;
		} catch (error) {
			if (!isNotFoundError(error) || this.negativeTtlMs <= 0) {
				throw error;
			}

			await this.writeCache(key, path, kind, {
				kind: "negative",
				message: error instanceof Error ? error.message : String(error),
				expiresAt: this.now() + this.negativeTtlMs,
			});
			throw error;
		}
	}

	private async writeCache(
		key: string,
		path: string,
		kind: CacheKeyKind,
		envelope: CacheEnvelope,
	): Promise<void> {
		const serialized = JSON.stringify(envelope);
		const size = Buffer.byteLength(serialized);
		if (Number.isFinite(this.maxBytes) && size > this.maxBytes) {
			await this.deleteKey(key);
			return;
		}

		await this.evictUntilFit(size, key);
		await this.cache.set(
			key,
			serialized,
			envelope.expiresAt === null ? undefined : envelope.expiresAt - this.now(),
		);
		this.metadata.set(key, {
			kind,
			path,
			size,
			writtenAt: this.now(),
		});
		await this.writeIndexRecord(
			key,
			{
				kind,
				path,
				size,
			},
			envelope.expiresAt,
		);
	}

	private async evictUntilFit(incomingSize: number, incomingKey: string): Promise<void> {
		if (!Number.isFinite(this.maxBytes)) {
			return;
		}

		let total = 0;
		for (const [key, meta] of this.metadata) {
			if (key !== incomingKey) {
				total += meta.size;
			}
		}

		const ordered = Array.from(this.metadata.entries()).sort(
			(left, right) => left[1].writtenAt - right[1].writtenAt,
		);

		for (const [key, meta] of ordered) {
			if (total + incomingSize <= this.maxBytes) {
				break;
			}

			total -= meta.size;
			await this.deleteKey(key);
		}
	}

	private async invalidateForMutation(path: string): Promise<void> {
		const normalized = normalizePath(path);
		// Mutations invalidate the touched node and all cached listings on its ancestors.
		await this.invalidatePath(normalized, true);
		for (const parent of parentPaths(normalized)) {
			await this.invalidatePath(parent, false);
		}
	}

	private async invalidatePath(path: string, includeDescendants: boolean): Promise<void> {
		const normalized = normalizePath(path);
		const records = await this.listCacheRecords();
		for (const [key, meta] of records) {
			const matchesPath = meta.path === normalized;
			const matchesDescendant =
				includeDescendants && meta.path.startsWith(descendantPrefix(normalized));
			const matchesParentListing =
				!includeDescendants &&
				meta.path === normalized &&
				(meta.kind === "readdir" || meta.kind === "readdirWithFileTypes" || meta.kind === "stat");

			if (matchesPath || matchesDescendant || matchesParentListing) {
				await this.deleteKey(key);
			}
		}
	}

	private async deleteKey(key: string): Promise<void> {
		await this.cache.delete(key);
		await this.cache.delete(this.indexKey(key));
		this.metadata.delete(key);
	}

	private indexKey(key: string): string {
		return `${this.keyPrefix}:index:${key}`;
	}

	private async writeIndexRecord(
		key: string,
		record: CacheIndexRecord,
		expiresAt: null | number,
	): Promise<void> {
		await this.cache.set(
			this.indexKey(key),
			JSON.stringify(record),
			expiresAt === null ? undefined : expiresAt - this.now(),
		);
	}

	private async listCacheRecords(): Promise<Array<[string, CacheIndexRecord]>> {
		const records = new Map<string, CacheIndexRecord>();
		for (const [key, meta] of this.metadata) {
			records.set(key, {
				kind: meta.kind,
				path: meta.path,
				size: meta.size,
			});
		}

		for (const key of await this.cache.list(`${this.keyPrefix}:index:`)) {
			const raw = await this.cache.get(key);
			if (!raw) {
				continue;
			}

			const parsed = this.parseIndexRecord(raw);
			if (!parsed) {
				await this.cache.delete(key);
				continue;
			}

			records.set(key.slice(`${this.keyPrefix}:index:`.length), parsed);
		}

		return Array.from(records.entries());
	}

	private parseIndexRecord(raw: string): CacheIndexRecord | null {
		try {
			const parsed = JSON.parse(raw) as Partial<CacheIndexRecord>;
			if (!parsed || typeof parsed !== "object") {
				return null;
			}
			if (!isCacheKeyKind(parsed.kind) || typeof parsed.path !== "string") {
				return null;
			}
			return {
				kind: parsed.kind,
				path: normalizePath(parsed.path),
				size: typeof parsed.size === "number" ? parsed.size : 0,
			};
		} catch {
			return null;
		}
	}
}

function isCacheKeyKind(value: unknown): value is CacheKeyKind {
	return (
		value === "readFile" ||
		value === "readFileBuffer" ||
		value === "readFileBytes" ||
		value === "stat" ||
		value === "readdir" ||
		value === "readdirWithFileTypes"
	);
}
