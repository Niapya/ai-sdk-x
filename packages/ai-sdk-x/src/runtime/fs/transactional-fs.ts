import {
	type BufferEncoding,
	type ByteString,
	type CpOptions,
	type FileContent,
	type FsStat,
	type IFileSystem,
	InMemoryFs,
	type MkdirOptions,
	type RmOptions,
} from "just-bash";
import { InMemoryKVStore } from "@/runtime/storage/in-memory-kv-store";
import type { KVStorage } from "@/types/storage";
import {
	cloneBytes,
	cloneStat,
	directoryNotEmptyError,
	existsError,
	type FsDirent,
	isDirectoryError,
	isNotFoundError,
	isSameOrDescendant,
	notDirectoryError,
	notFoundError,
	readBytesFrom,
	toByteString,
	toBytes,
} from "@/utils/data";
import { dirname, joinPath, normalizePath, parentPaths, resolvePath } from "@/utils/path";

type ReadFileOptions = Parameters<IFileSystem["readFile"]>[1];
type WriteFileOptions = Parameters<IFileSystem["writeFile"]>[2];

/**
 * Configuration for the transactional filesystem overlay.
 */
export interface TransactionalFsOptions {
	cache?: KVStorage;
	fs: IFileSystem;
	now?: () => Date;
}

/**
 * Summary of overlay changes waiting to be committed to the backing filesystem.
 */
export interface TransactionalFsStatus {
	added: string[];
	modified: string[];
	deleted: string[];
}

/**
 * Filesystem wrapper that stages mutations in memory until commit().
 *
 * Reads observe the in-memory overlay first, then fall back to the wrapped
 * filesystem. Writes are coalesced in the overlay so repeated updates only hit
 * the backing store once during commit().
 */
export class TransactionalFs implements IFileSystem {
	private readonly fs: IFileSystem;
	private readonly overlay = new InMemoryFs();
	private readonly cache: KVStorage;
	private readonly now: () => Date;
	private readonly deletedRoots = new Set<string>();

	constructor(options: TransactionalFsOptions) {
		this.fs = options.fs;
		this.cache = options.cache ?? new InMemoryKVStore();
		this.now = options.now ?? (() => new Date());
	}

	async readFile(path: string, options?: ReadFileOptions): Promise<string> {
		const bytes = await this.readFileBuffer(path);
		const encoding = typeof options === "string" ? options : options?.encoding;
		return encoding === null ? new TextDecoder().decode(bytes) : this.decode(bytes, encoding);
	}

	async readFileBytes(path: string): Promise<ByteString> {
		return toByteString(await this.readFileBuffer(path));
	}

	async readFileBuffer(path: string): Promise<Uint8Array> {
		const normalized = normalizePath(path);
		if (await this.overlay.exists(normalized)) {
			const stat = await this.overlay.lstat(normalized);
			if (stat.isDirectory) {
				throw isDirectoryError("read", path);
			}
			return cloneBytes(await this.overlay.readFileBuffer(normalized));
		}

		if (this.isDeleted(normalized)) {
			throw notFoundError("open", path);
		}

		return cloneBytes(await this.fs.readFileBuffer(normalized));
	}

	async writeFile(path: string, content: FileContent, options?: WriteFileOptions): Promise<void> {
		const normalized = normalizePath(path);
		await this.ensureParentDirectories(normalized);
		const previousStat = await this.tryStat(normalized);
		if (previousStat?.isDirectory) {
			await this.rm(normalized, { force: true, recursive: true });
		}

		await this.overlay.writeFile(normalized, toBytes(content, this.getEncoding(options)));
		await this.overlay.utimes(normalized, this.now(), this.now());
		await this.materializeDeletedRootRemainders(normalized);
		if (previousStat) {
			await this.overlay.chmod(normalized, previousStat.mode);
		}
	}

	async appendFile(path: string, content: FileContent, options?: WriteFileOptions): Promise<void> {
		const normalized = normalizePath(path);
		await this.ensureFileMaterialized(normalized);
		const bytes = toBytes(content, this.getEncoding(options));
		await this.overlay.appendFile(normalized, bytes);
		await this.overlay.utimes(normalized, this.now(), this.now());
	}

	async exists(path: string): Promise<boolean> {
		const normalized = normalizePath(path);
		if (await this.overlay.exists(normalized)) {
			return true;
		}

		if (this.isDeleted(normalized)) {
			return false;
		}

		return this.fs.exists(normalized);
	}

	async stat(path: string): Promise<FsStat> {
		const normalized = normalizePath(path);
		if (await this.overlay.exists(normalized)) {
			return cloneStat(await this.overlay.stat(normalized));
		}

		if (this.isDeleted(normalized)) {
			throw notFoundError("stat", path);
		}

		return cloneStat(await this.fs.stat(normalized));
	}

	async mkdir(path: string, options?: MkdirOptions): Promise<void> {
		const normalized = normalizePath(path);
		if (await this.overlay.exists(normalized)) {
			const stat = await this.overlay.lstat(normalized);
			if (stat.isDirectory) {
				if (!options?.recursive) {
					throw existsError("mkdir", path);
				}
				return;
			}

			throw existsError("mkdir", path);
		}

		if (!options?.recursive) {
			const parent = dirname(normalized);
			if (!(await this.exists(parent))) {
				throw notFoundError("mkdir", path);
			}
		}

		await this.overlay.mkdir(normalized, { recursive: options?.recursive ?? false });
		await this.overlay.utimes(normalized, this.now(), this.now());
		await this.materializeDeletedRootRemainders(normalized);
	}

	async readdir(path: string): Promise<string[]> {
		return (await this.readdirWithFileTypes(path)).map((entry) => entry.name);
	}

	async readdirWithFileTypes(path: string): Promise<FsDirent[]> {
		const normalized = normalizePath(path);
		const overlayExists = await this.overlay.exists(normalized);

		if (overlayExists) {
			const overlayStat = await this.overlay.lstat(normalized);
			if (!overlayStat.isDirectory) {
				throw notDirectoryError("scandir", path);
			}
		} else if (this.isDeleted(normalized)) {
			throw notFoundError("scandir", path);
		}

		const overlayEntries = overlayExists
			? await this.overlay.readdirWithFileTypes?.(normalized)
			: undefined;
		const entries = new Map<string, FsDirent>();

		if (!this.hasDeletedAncestorOrSelf(normalized) && (await this.fs.exists(normalized))) {
			const baseStat = await this.fs.stat(normalized);
			if (!baseStat.isDirectory) {
				throw notDirectoryError("scandir", path);
			}

			const baseEntries = this.fs.readdirWithFileTypes
				? await this.fs.readdirWithFileTypes(normalized)
				: await this.readDirentsFromStats(this.fs, normalized);

			for (const entry of baseEntries) {
				const childPath = joinPath(normalized, entry.name);
				if (this.isDeleted(childPath) || (await this.overlay.exists(childPath))) {
					continue;
				}
				entries.set(entry.name, { ...entry });
			}
		}

		for (const entry of overlayEntries ?? []) {
			entries.set(entry.name, { ...entry });
		}

		if (!overlayExists && entries.size === 0) {
			throw notFoundError("scandir", path);
		}

		return Array.from(entries.values()).sort((left, right) => left.name.localeCompare(right.name));
	}

	async rm(path: string, options?: RmOptions): Promise<void> {
		const normalized = normalizePath(path);
		const exists = await this.exists(normalized);
		if (!exists) {
			if (options?.force) {
				return;
			}
			throw notFoundError("rm", path);
		}

		const stat = await this.stat(normalized);
		if (stat.isDirectory && !options?.recursive) {
			if ((await this.readdir(normalized)).length > 0) {
				throw directoryNotEmptyError(path);
			}
		}

		await this.removeOverlaySubtree(normalized);
		this.addDeletedRoot(normalized);
	}

	async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
		const srcPath = normalizePath(src);
		const destPath = normalizePath(dest);
		const srcStat = await this.stat(srcPath);

		if (srcStat.isDirectory && !options?.recursive) {
			throw new Error(`ERR_FS_CP_EISDIR: cp '${src}'`);
		}

		await this.copyNode(srcPath, destPath, options);
	}

	async mv(src: string, dest: string): Promise<void> {
		const srcPath = normalizePath(src);
		const destPath = normalizePath(dest);
		const srcStat = await this.stat(srcPath);
		await this.copyNode(srcPath, destPath, { recursive: srcStat.isDirectory });
		await this.rm(srcPath, { recursive: srcStat.isDirectory, force: false });
	}

	resolvePath(base: string, path: string): string {
		return resolvePath(base, path);
	}

	getAllPaths(): string[] {
		const paths = new Set<string>(["/"]);

		for (const path of this.fs.getAllPaths()) {
			if (!this.isDeleted(path)) {
				paths.add(normalizePath(path));
			}
		}

		for (const path of this.overlay.getAllPaths()) {
			paths.add(normalizePath(path));
		}

		return Array.from(paths).sort();
	}

	async chmod(path: string, mode: number): Promise<void> {
		const normalized = normalizePath(path);
		await this.ensureEntryMaterialized(normalized);
		await this.overlay.chmod(normalized, mode);
	}

	async symlink(target: string, linkPath: string): Promise<void> {
		const normalized = normalizePath(linkPath);
		await this.ensureParentDirectories(normalized);
		await this.overlay.symlink(target, normalized);
		await this.materializeDeletedRootRemainders(normalized);
	}

	async link(existingPath: string, newPath: string): Promise<void> {
		const existing = normalizePath(existingPath);
		const next = normalizePath(newPath);
		const stat = await this.stat(existing);
		if (!stat.isFile) {
			throw isDirectoryError("link", existingPath);
		}
		await this.writeFile(next, await this.readFileBuffer(existing));
	}

	async readlink(path: string): Promise<string> {
		const normalized = normalizePath(path);
		if (await this.overlay.exists(normalized)) {
			return this.overlay.readlink(normalized);
		}

		if (this.isDeleted(normalized)) {
			throw notFoundError("readlink", path);
		}

		return this.fs.readlink(normalized);
	}

	async lstat(path: string): Promise<FsStat> {
		const normalized = normalizePath(path);
		if (await this.overlay.exists(normalized)) {
			return cloneStat(await this.overlay.lstat(normalized));
		}

		if (this.isDeleted(normalized)) {
			throw notFoundError("lstat", path);
		}

		return cloneStat(await this.fs.lstat(normalized));
	}

	async realpath(path: string): Promise<string> {
		const normalized = normalizePath(path);
		if ((await this.overlay.exists(normalized)) || this.hasDeletedAncestorOrSelf(normalized)) {
			return normalized;
		}

		return this.fs.realpath(normalized);
	}

	async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
		const normalized = normalizePath(path);
		await this.ensureEntryMaterialized(normalized);
		await this.overlay.utimes(normalized, atime, mtime);
	}

	async commit(): Promise<void> {
		void this.cache;

		// Flush deletes first so recreated paths can be written cleanly afterwards.
		const deletedRoots = Array.from(this.deletedRoots).sort(
			(left, right) => right.length - left.length,
		);
		for (const path of deletedRoots) {
			await this.fs.rm(path, { force: true, recursive: true });
		}

		const overlayPaths = this.overlay
			.getAllPaths()
			.filter((path) => path !== "/")
			.sort();
		for (const path of overlayPaths) {
			const stat = await this.overlay.lstat(path);
			if (stat.isDirectory) {
				await this.fs.mkdir(path, { recursive: true });
				await this.fs.chmod(path, stat.mode);
				await this.fs.utimes(path, stat.mtime, stat.mtime);
				continue;
			}

			if (stat.isSymbolicLink) {
				await this.fs.rm(path, { force: true, recursive: true });
				await this.fs.symlink(await this.overlay.readlink(path), path);
				continue;
			}

			await this.fs.mkdir(dirname(path), { recursive: true });
			await this.fs.writeFile(path, await this.overlay.readFileBuffer(path));
			await this.fs.chmod(path, stat.mode);
			await this.fs.utimes(path, stat.mtime, stat.mtime);
		}

		await this.rollback();
	}

	/**
	 * Discard all pending overlay changes.
	 */
	async rollback(): Promise<void> {
		this.deletedRoots.clear();
		for (const path of this.overlay
			.getAllPaths()
			.filter((path) => path !== "/")
			.sort((a, b) => b.length - a.length)) {
			await this.overlay.rm(path, { force: true, recursive: true });
		}
	}

	/**
	 * Report pending overlay changes relative to the wrapped filesystem.
	 */
	async status(): Promise<TransactionalFsStatus> {
		const added: string[] = [];
		const modified: string[] = [];
		const deleted = Array.from(this.deletedRoots).sort();

		for (const path of this.overlay.getAllPaths()) {
			if (path === "/") {
				continue;
			}

			const baseExists = !this.isDeleted(path) && (await this.fs.exists(path));
			if (!baseExists) {
				added.push(path);
				continue;
			}

			modified.push(path);
		}

		return {
			added: added.sort(),
			modified: modified.sort(),
			deleted,
		};
	}

	private decode(bytes: Uint8Array, encoding?: BufferEncoding | null): string {
		if (encoding === "binary" || encoding === "latin1") {
			return String.fromCharCode(...bytes);
		}
		if (encoding === "base64") {
			return Buffer.from(bytes).toString("base64");
		}
		if (encoding === "hex") {
			return Buffer.from(bytes).toString("hex");
		}

		return new TextDecoder().decode(bytes);
	}

	private getEncoding(
		options?: WriteFileOptions | ReadFileOptions,
	): BufferEncoding | null | undefined {
		return typeof options === "string" ? options : options?.encoding;
	}

	private addDeletedRoot(path: string): void {
		const normalized = normalizePath(path);
		for (const existing of Array.from(this.deletedRoots)) {
			if (isSameOrDescendant(existing, normalized)) {
				this.deletedRoots.delete(existing);
			}
			if (isSameOrDescendant(normalized, existing)) {
				return;
			}
		}

		this.deletedRoots.add(normalized);
	}

	private async materializeDeletedRootRemainders(path: string): Promise<void> {
		const normalized = normalizePath(path);
		for (const existing of Array.from(this.deletedRoots)) {
			if (isSameOrDescendant(existing, normalized)) {
				this.deletedRoots.delete(existing);
				await this.addDeletedRemainders(existing);
			}
		}
	}

	private async addDeletedRemainders(root: string): Promise<void> {
		if (!(await this.fs.exists(root))) {
			return;
		}

		const stat = await this.fs.lstat(root);
		if (!stat.isDirectory) {
			if (!(await this.overlay.exists(root))) {
				this.addDeletedRoot(root);
			}
			return;
		}

		for (const entry of await this.readDirentsFromStats(this.fs, root)) {
			const childPath = joinPath(root, entry.name);
			if (await this.overlay.exists(childPath)) {
				if (entry.isDirectory) {
					await this.addDeletedRemainders(childPath);
				}
				continue;
			}

			this.addDeletedRoot(childPath);
		}
	}

	private isDeleted(path: string): boolean {
		const normalized = normalizePath(path);
		if (this.overlay.getAllPaths().includes(normalized)) {
			return false;
		}

		return this.hasDeletedAncestorOrSelf(normalized);
	}

	private hasDeletedAncestorOrSelf(path: string): boolean {
		const normalized = normalizePath(path);
		if (this.deletedRoots.has(normalized)) {
			return true;
		}

		for (const parent of parentPaths(normalized)) {
			if (this.deletedRoots.has(parent)) {
				return true;
			}
		}

		return false;
	}

	private async ensureParentDirectories(path: string): Promise<void> {
		await this.overlay.mkdir(dirname(path), { recursive: true });
	}

	private async ensureEntryMaterialized(path: string): Promise<void> {
		const normalized = normalizePath(path);
		if (await this.overlay.exists(normalized)) {
			return;
		}

		if (this.isDeleted(normalized)) {
			throw notFoundError("stat", path);
		}

		const stat = await this.fs.lstat(normalized);
		// Mirror the current backing node into the overlay so later mutations stay local.
		if (stat.isDirectory) {
			await this.overlay.mkdir(normalized, { recursive: true });
		} else if (stat.isSymbolicLink) {
			await this.overlay.symlink(await this.fs.readlink(normalized), normalized);
		} else {
			await this.overlay.writeFile(normalized, await readBytesFrom(this.fs, normalized));
		}

		await this.overlay.chmod(normalized, stat.mode);
		await this.overlay.utimes(normalized, stat.mtime, stat.mtime);
	}

	private async ensureFileMaterialized(path: string): Promise<void> {
		if (await this.overlay.exists(path)) {
			const stat = await this.overlay.stat(path);
			if (stat.isDirectory) {
				throw isDirectoryError("write", path);
			}
			return;
		}

		if (this.isDeleted(path)) {
			await this.writeFile(path, new Uint8Array());
			return;
		}

		try {
			const stat = await this.fs.stat(path);
			if (stat.isDirectory) {
				throw isDirectoryError("write", path);
			}
			await this.ensureEntryMaterialized(path);
		} catch (error) {
			if (!isNotFoundError(error)) {
				throw error;
			}

			await this.writeFile(path, new Uint8Array());
		}
	}

	private async tryStat(path: string): Promise<FsStat | null> {
		try {
			return await this.stat(path);
		} catch (error) {
			if (isNotFoundError(error)) {
				return null;
			}

			throw error;
		}
	}

	private async removeOverlaySubtree(path: string): Promise<void> {
		for (const candidate of this.overlay
			.getAllPaths()
			.filter((candidate) => isSameOrDescendant(path, candidate))
			.sort((a, b) => b.length - a.length)) {
			if (candidate === "/") {
				continue;
			}
			await this.overlay.rm(candidate, { force: true, recursive: true });
		}
	}

	private async readDirentsFromStats(fs: IFileSystem, path: string): Promise<FsDirent[]> {
		const names = await fs.readdir(path);
		const entries = await Promise.all(
			names.map(async (name) => {
				const stat = await fs.lstat(joinPath(path, name));
				return {
					name,
					isFile: stat.isFile,
					isDirectory: stat.isDirectory,
					isSymbolicLink: stat.isSymbolicLink,
				};
			}),
		);

		return entries.sort((left, right) => left.name.localeCompare(right.name));
	}

	private async copyNode(srcPath: string, destPath: string, options?: CpOptions): Promise<void> {
		const stat = await this.lstat(srcPath);
		await this.rm(destPath, { force: true, recursive: true }).catch((error) => {
			if (!isNotFoundError(error)) {
				throw error;
			}
		});

		if (stat.isDirectory) {
			if (!options?.recursive) {
				throw new Error(`ERR_FS_CP_EISDIR: cp '${srcPath}'`);
			}
			await this.mkdir(destPath, { recursive: true });
			await this.chmod(destPath, stat.mode);
			await this.utimes(destPath, stat.mtime, stat.mtime);
			for (const entry of await this.readdirWithFileTypes(srcPath)) {
				await this.copyNode(joinPath(srcPath, entry.name), joinPath(destPath, entry.name), options);
			}
			return;
		}

		if (stat.isSymbolicLink) {
			await this.symlink(await this.readlink(srcPath), destPath);
			return;
		}

		await this.writeFile(destPath, await this.readFileBuffer(srcPath));
		await this.chmod(destPath, stat.mode);
		await this.utimes(destPath, stat.mtime, stat.mtime);
	}
}
