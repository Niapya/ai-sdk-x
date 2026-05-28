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
	createStat,
	directoryNotEmptyError,
	type FsDirent,
	isSameOrDescendant,
	toByteString,
} from "@/utils/data";
import { dirname, joinPath, normalizePath, parentPaths, resolvePath } from "@/utils/path";

type ReadFileOptions = Parameters<IFileSystem["readFile"]>[1];
type WriteFileOptions = Parameters<IFileSystem["writeFile"]>[2];

interface ManifestNode {
	mode: number;
	mtime: string;
	path: string;
	size: number;
	target?: string;
	type: "directory" | "file" | "symlink";
}

interface ManifestChildren {
	children: string[];
}

/**
 * Configuration for the manifest-backed indexed filesystem wrapper.
 */
export interface IndexedFsOptions {
	cache?: KVStorage;
	fs: IFileSystem;
	manifestPrefix?: string;
	now?: () => Date;
}

/**
 * Manifest-driven filesystem wrapper for object-storage-like backends.
 *
 * Directory listings and stat calls are answered from KV-backed index entries
 * instead of walking the backing filesystem, while file contents still stream
 * from the wrapped filesystem.
 */
export class IndexedFs implements IFileSystem {
	private readonly cache: KVStorage;
	private readonly fs: IFileSystem;
	private readonly manifestPrefix: string;
	private readonly now: () => Date;
	private rootPromise: null | Promise<void> = null;

	constructor(options: IndexedFsOptions) {
		this.fs = options.fs;
		this.cache = options.cache ?? new InMemoryKVStore();
		this.manifestPrefix = options.manifestPrefix ?? "runtime-storage:index";
		this.now = options.now ?? (() => new Date());
	}

	async readFile(path: string, options?: ReadFileOptions): Promise<string> {
		await this.assertIndexed(path, "open");
		return this.fs.readFile(normalizePath(path), options);
	}

	async readFileBytes(path: string): Promise<ByteString> {
		await this.assertIndexed(path, "open");
		return this.fs.readFileBytes
			? this.fs.readFileBytes(normalizePath(path))
			: toByteString(await this.fs.readFileBuffer(normalizePath(path)));
	}

	async readFileBuffer(path: string): Promise<Uint8Array> {
		await this.assertIndexed(path, "open");
		return this.fs.readFileBuffer(normalizePath(path));
	}

	async writeFile(path: string, content: FileContent, options?: WriteFileOptions): Promise<void> {
		const normalized = normalizePath(path);
		await this.ensureRoot();
		await this.ensureIndexedParents(normalized);
		await this.fs.mkdir(dirname(normalized), { recursive: true });
		await this.fs.writeFile(normalized, content, options);
		await this.persistNode(normalized);
	}

	async appendFile(path: string, content: FileContent, options?: WriteFileOptions): Promise<void> {
		const normalized = normalizePath(path);
		await this.ensureRoot();
		await this.ensureIndexedParents(normalized);
		if (!(await this.exists(normalized))) {
			await this.writeFile(normalized, new Uint8Array(), options);
		}
		await this.fs.appendFile(normalized, content, options);
		await this.persistNode(normalized);
	}

	async exists(path: string): Promise<boolean> {
		return (await this.readNode(normalizePath(path))) !== null;
	}

	async stat(path: string): Promise<FsStat> {
		const node = await this.requireNode(path, "stat");
		return this.nodeToStat(node);
	}

	async mkdir(path: string, options?: MkdirOptions): Promise<void> {
		const normalized = normalizePath(path);
		await this.ensureRoot();
		if (options?.recursive) {
			await this.ensureIndexedParents(normalized);
		}
		await this.fs.mkdir(normalized, options);
		await this.ensureIndexedDirectory(normalized);
	}

	async readdir(path: string): Promise<string[]> {
		const normalized = normalizePath(path);
		const node = await this.requireNode(normalized, "scandir");
		if (node.type !== "directory") {
			throw new Error(`ENOTDIR: not a directory, scandir '${path}'`);
		}

		return [...(await this.readChildren(normalized))].sort();
	}

	async readdirWithFileTypes(path: string): Promise<FsDirent[]> {
		const normalized = normalizePath(path);
		const names = await this.readdir(normalized);
		const nodes = await Promise.all(
			names.map((name) => this.requireNode(joinPath(normalized, name), "scandir")),
		);
		return nodes.map((node, index) => ({
			name: names[index],
			isFile: node.type === "file",
			isDirectory: node.type === "directory",
			isSymbolicLink: node.type === "symlink",
		}));
	}

	async rm(path: string, options?: RmOptions): Promise<void> {
		const normalized = normalizePath(path);
		const node = await this.requireNode(normalized, "rm");
		if (node.type === "directory" && !options?.recursive) {
			if ((await this.readChildren(normalized)).length > 0) {
				throw directoryNotEmptyError(path);
			}
		}

		await this.fs.rm(normalized, options);
		await this.removeIndexedSubtree(normalized);
	}

	async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
		const sourcePath = normalizePath(src);
		const destinationPath = normalizePath(dest);
		const sourceNode = await this.requireNode(sourcePath, "cp");
		await this.fs.cp(sourcePath, destinationPath, options);
		await this.ensureIndexedParents(destinationPath);
		await this.removeIndexedSubtree(destinationPath, true);
		await this.cloneSubtree(sourcePath, destinationPath, sourceNode.type === "directory");
	}

	async mv(src: string, dest: string): Promise<void> {
		const sourcePath = normalizePath(src);
		const destinationPath = normalizePath(dest);
		const sourceNode = await this.requireNode(sourcePath, "mv");
		await this.fs.mv(sourcePath, destinationPath);
		await this.ensureIndexedParents(destinationPath);
		await this.removeIndexedSubtree(destinationPath, true);
		await this.remapSubtree(sourcePath, destinationPath, sourceNode.type === "directory");
	}

	resolvePath(base: string, path: string): string {
		return resolvePath(base, path);
	}

	getAllPaths(): string[] {
		return this.fs.getAllPaths();
	}

	async chmod(path: string, mode: number): Promise<void> {
		const normalized = normalizePath(path);
		await this.requireNode(normalized, "chmod");
		await this.fs.chmod(normalized, mode);
		await this.persistNode(normalized);
	}

	async symlink(target: string, linkPath: string): Promise<void> {
		const normalized = normalizePath(linkPath);
		await this.ensureIndexedParents(normalized);
		await this.fs.symlink(target, normalized);
		await this.persistNode(normalized);
	}

	async link(existingPath: string, newPath: string): Promise<void> {
		const normalized = normalizePath(newPath);
		await this.ensureIndexedParents(normalized);
		await this.fs.link(normalizePath(existingPath), normalized);
		await this.persistNode(normalized);
	}

	async readlink(path: string): Promise<string> {
		await this.assertIndexed(path, "readlink");
		return this.fs.readlink(normalizePath(path));
	}

	async lstat(path: string): Promise<FsStat> {
		const node = await this.requireNode(path, "lstat");
		return this.nodeToStat(node);
	}

	async realpath(path: string): Promise<string> {
		await this.assertIndexed(path, "realpath");
		return this.fs.realpath(normalizePath(path));
	}

	async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
		const normalized = normalizePath(path);
		await this.requireNode(normalized, "utimes");
		await this.fs.utimes(normalized, atime, mtime);
		await this.persistNode(normalized);
	}

	private async ensureRoot(): Promise<void> {
		if (!this.rootPromise) {
			this.rootPromise = (async () => {
				const root = await this.readNode("/");
				if (root) {
					return;
				}

				await this.writeNode("/", {
					path: "/",
					type: "directory",
					mode: 0o755,
					size: 0,
					mtime: this.now().toISOString(),
				});
				await this.writeChildren("/", []);
			})();
		}

		await this.rootPromise;
	}

	private async ensureIndexedParents(path: string): Promise<void> {
		await this.ensureRoot();
		for (const parent of parentPaths(path).reverse()) {
			await this.ensureIndexedDirectory(parent);
		}
	}

	private async ensureIndexedDirectory(path: string): Promise<void> {
		const normalized = normalizePath(path);
		const existing = await this.readNode(normalized);
		if (existing) {
			if (existing.type !== "directory") {
				throw new Error(`ENOTDIR: not a directory, mkdir '${path}'`);
			}
			return;
		}

		await this.writeNode(normalized, {
			path: normalized,
			type: "directory",
			mode: 0o755,
			size: 0,
			mtime: this.now().toISOString(),
		});
		await this.writeChildren(normalized, await this.readChildren(normalized));
		await this.addChild(dirname(normalized), this.nameOf(normalized));
	}

	private async persistNode(path: string): Promise<void> {
		await this.ensureRoot();
		const normalized = normalizePath(path);
		const stat = await this.fs.lstat(normalized);
		const node: ManifestNode = {
			path: normalized,
			type: stat.isDirectory ? "directory" : stat.isSymbolicLink ? "symlink" : "file",
			mode: stat.mode,
			size: stat.size,
			mtime: stat.mtime.toISOString(),
		};

		if (node.type === "symlink") {
			node.target = await this.fs.readlink(normalized);
		}

		await this.writeNode(normalized, node);
		if (node.type === "directory") {
			// Directory manifests cache the child names so readdir never scans the backend.
			await this.writeChildren(normalized, await this.fs.readdir(normalized));
		}
		await this.addChild(dirname(normalized), this.nameOf(normalized));
	}

	private async assertIndexed(path: string, operation: string): Promise<void> {
		await this.requireNode(path, operation);
	}

	private async requireNode(path: string, operation: string): Promise<ManifestNode> {
		await this.ensureRoot();
		const node = await this.readNode(normalizePath(path));
		if (!node) {
			throw new Error(`ENOENT: no such file or directory, ${operation} '${path}'`);
		}

		return node;
	}

	private nodeToStat(node: ManifestNode): FsStat {
		return createStat({
			isFile: node.type === "file",
			isDirectory: node.type === "directory",
			isSymbolicLink: node.type === "symlink",
			mode: node.mode,
			size: node.size,
			mtime: new Date(node.mtime),
		});
	}

	private async cloneSubtree(src: string, dest: string, recursive: boolean): Promise<void> {
		const sourceNode = await this.requireNode(src, "cp");
		if (sourceNode.type === "directory" && !recursive) {
			throw new Error(`ERR_FS_CP_EISDIR: cp '${src}'`);
		}

		const nodeKeys = (await this.listNodeKeysUnder(src)).sort();
		const childrenKeys = (await this.listChildrenKeysUnder(src)).sort();

		// Copy manifest records by key rewrite so list/stat stay index-only after cp.
		for (const key of nodeKeys) {
			const path = key.slice(this.nodeKeyPrefix.length);
			const suffix = path === src ? "" : path.slice(src.length);
			const nextPath = `${dest}${suffix}`;
			const node = await this.readNode(path);
			if (!node) {
				continue;
			}
			await this.writeNode(nextPath, { ...node, path: nextPath, mtime: this.now().toISOString() });
		}

		for (const key of childrenKeys) {
			const path = key.slice(this.childrenKeyPrefix.length);
			const suffix = path === src ? "" : path.slice(src.length);
			const nextPath = `${dest}${suffix}`;
			const children = await this.readChildren(path);
			await this.writeChildren(nextPath, children);
		}

		await this.addChild(dirname(dest), this.nameOf(dest));
	}

	private async remapSubtree(src: string, dest: string, recursive: boolean): Promise<void> {
		await this.cloneSubtree(src, dest, recursive);
		await this.removeIndexedSubtree(src);
	}

	private async removeIndexedSubtree(path: string, keepMissing = false): Promise<void> {
		const normalized = normalizePath(path);
		const node = await this.readNode(normalized);
		if (!node) {
			if (keepMissing) {
				return;
			}
			throw new Error(`ENOENT: no such file or directory, rm '${path}'`);
		}

		const nodeKeys = (await this.listNodeKeysUnder(normalized)).sort(
			(left, right) => right.length - left.length,
		);
		const childKeys = (await this.listChildrenKeysUnder(normalized)).sort(
			(left, right) => right.length - left.length,
		);

		for (const key of childKeys) {
			await this.cache.delete(key);
		}
		for (const key of nodeKeys) {
			await this.cache.delete(key);
		}

		await this.removeChild(dirname(normalized), this.nameOf(normalized));
	}

	private async readNode(path: string): Promise<ManifestNode | null> {
		const raw = await this.cache.get(this.nodeKey(normalizePath(path)));
		return raw ? (JSON.parse(raw) as ManifestNode) : null;
	}

	private async listNodeKeysUnder(path: string): Promise<string[]> {
		const normalized = normalizePath(path);
		const keys = await this.cache.list(this.nodeKey(normalized));
		return keys.filter((key) => {
			const candidate = key.slice(this.nodeKeyPrefix.length);
			return isSameOrDescendant(normalized, candidate);
		});
	}

	private async listChildrenKeysUnder(path: string): Promise<string[]> {
		const normalized = normalizePath(path);
		const keys = await this.cache.list(this.childrenKey(normalized));
		return keys.filter((key) => {
			const candidate = key.slice(this.childrenKeyPrefix.length);
			return isSameOrDescendant(normalized, candidate);
		});
	}

	private async writeNode(path: string, node: ManifestNode): Promise<void> {
		await this.cache.set(this.nodeKey(normalizePath(path)), JSON.stringify(node));
	}

	private async readChildren(path: string): Promise<string[]> {
		const raw = await this.cache.get(this.childrenKey(normalizePath(path)));
		if (!raw) {
			return [];
		}

		return [...(JSON.parse(raw) as ManifestChildren).children].sort();
	}

	private async writeChildren(path: string, children: string[]): Promise<void> {
		await this.cache.set(
			this.childrenKey(normalizePath(path)),
			JSON.stringify({ children: Array.from(new Set(children)).sort() } satisfies ManifestChildren),
		);
	}

	private async addChild(path: string, child: string): Promise<void> {
		if (!child) {
			return;
		}
		const normalized = normalizePath(path);
		const children = await this.readChildren(normalized);
		children.push(child);
		await this.writeChildren(normalized, children);
	}

	private async removeChild(path: string, child: string): Promise<void> {
		if (!child) {
			return;
		}
		const normalized = normalizePath(path);
		const children = (await this.readChildren(normalized)).filter((entry) => entry !== child);
		await this.writeChildren(normalized, children);
	}

	private nameOf(path: string): string {
		const normalized = normalizePath(path);
		if (normalized === "/") {
			return "";
		}
		return normalized.slice(normalized.lastIndexOf("/") + 1);
	}

	private nodeKey(path: string): string {
		return `${this.nodeKeyPrefix}${normalizePath(path)}`;
	}

	private childrenKey(path: string): string {
		return `${this.childrenKeyPrefix}${normalizePath(path)}`;
	}

	private get nodeKeyPrefix(): string {
		return `${this.manifestPrefix}:node:`;
	}

	private get childrenKeyPrefix(): string {
		return `${this.manifestPrefix}:children:`;
	}
}
