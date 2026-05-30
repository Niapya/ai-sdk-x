import type { FileContent, FsStat, IFileSystem } from "just-bash";
import { normalizePath, resolvePath } from "@/utils/path";

type ReadFileOptions = Parameters<IFileSystem["readFile"]>[1];
type WriteFileOptions = Parameters<IFileSystem["writeFile"]>[2];
type MkdirOptions = Parameters<IFileSystem["mkdir"]>[1];
type RmOptions = Parameters<IFileSystem["rm"]>[1];
type CpOptions = Parameters<IFileSystem["cp"]>[2];

/**
 * Create a filesystem view rooted at `root`, translating all local paths into the wrapped fs.
 */
export function createSubpathFs(fs: IFileSystem, root: string): IFileSystem {
	return new SubpathFs(fs, root);
}

class SubpathFs implements IFileSystem {
	private readonly fs: IFileSystem;
	private readonly root: string;

	constructor(fs: IFileSystem, root: string) {
		this.fs = fs;
		this.root = normalizePath(root);
	}

	async readFile(path: string, options?: ReadFileOptions): Promise<string> {
		return this.fs.readFile(this.toSourcePath(path), options);
	}

	async readFileBuffer(path: string): Promise<Uint8Array> {
		return this.fs.readFileBuffer(this.toSourcePath(path));
	}

	async writeFile(path: string, content: FileContent, options?: WriteFileOptions): Promise<void> {
		return this.fs.writeFile(this.toSourcePath(path), content, options);
	}

	async appendFile(path: string, content: FileContent, options?: WriteFileOptions): Promise<void> {
		return this.fs.appendFile(this.toSourcePath(path), content, options);
	}

	async exists(path: string): Promise<boolean> {
		return this.fs.exists(this.toSourcePath(path));
	}

	async stat(path: string): Promise<FsStat> {
		return this.fs.stat(this.toSourcePath(path));
	}

	async mkdir(path: string, options?: MkdirOptions): Promise<void> {
		return this.fs.mkdir(this.toSourcePath(path), options);
	}

	async readdir(path: string): Promise<string[]> {
		return this.fs.readdir(this.toSourcePath(path));
	}

	async rm(path: string, options?: RmOptions): Promise<void> {
		return this.fs.rm(this.toSourcePath(path), options);
	}

	async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
		return this.fs.cp(this.toSourcePath(src), this.toSourcePath(dest), options);
	}

	async mv(src: string, dest: string): Promise<void> {
		return this.fs.mv(this.toSourcePath(src), this.toSourcePath(dest));
	}

	resolvePath(base: string, path: string): string {
		return resolvePath(base, path);
	}

	getAllPaths(): string[] {
		const allPaths = new Set<string>(["/"]);

		for (const path of this.fs.getAllPaths()) {
			const localPath = this.fromSourcePath(path);
			if (localPath) {
				allPaths.add(localPath);
			}
		}

		return Array.from(allPaths).sort();
	}

	async chmod(path: string, mode: number): Promise<void> {
		return this.fs.chmod(this.toSourcePath(path), mode);
	}

	async symlink(target: string, linkPath: string): Promise<void> {
		return this.fs.symlink(this.toSourceTarget(target), this.toSourcePath(linkPath));
	}

	async link(existingPath: string, newPath: string): Promise<void> {
		return this.fs.link(this.toSourcePath(existingPath), this.toSourcePath(newPath));
	}

	async readlink(path: string): Promise<string> {
		const target = await this.fs.readlink(this.toSourcePath(path));
		return this.fromSourceTarget(target);
	}

	async lstat(path: string): Promise<FsStat> {
		return this.fs.lstat(this.toSourcePath(path));
	}

	async realpath(path: string): Promise<string> {
		const resolvedPath = await this.fs.realpath(this.toSourcePath(path));
		const localPath = this.fromSourcePath(resolvedPath);

		if (!localPath) {
			throw new Error(
				`EACCES: permission denied, realpath '${path}' resolves outside mounted root`,
			);
		}

		return localPath;
	}

	async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
		return this.fs.utimes(this.toSourcePath(path), atime, mtime);
	}

	private toSourcePath(path: string): string {
		assertMountLocalPath(path);
		const normalizedPath = normalizePath(path);
		if (normalizedPath === "/") {
			return this.root;
		}

		return resolvePath(this.root, normalizedPath.slice(1));
	}

	private fromSourcePath(path: string): string | null {
		const normalizedPath = normalizePath(path);

		if (this.root === "/") {
			return normalizedPath;
		}

		if (normalizedPath === this.root) {
			return "/";
		}

		const prefix = `${this.root}/`;
		if (!normalizedPath.startsWith(prefix)) {
			return null;
		}

		return `/${normalizedPath.slice(prefix.length)}`;
	}

	private toSourceTarget(target: string): string {
		if (!target.startsWith("/")) {
			return target;
		}

		return this.toSourcePath(target);
	}

	private fromSourceTarget(target: string): string {
		if (!target.startsWith("/")) {
			return target;
		}

		return this.fromSourcePath(target) ?? target;
	}
}

function assertMountLocalPath(path: string): void {
	let depth = 0;
	const segments = path.split("/");
	for (const segment of segments) {
		if (!segment || segment === ".") {
			continue;
		}
		if (segment === "..") {
			if (depth === 0) {
				throw new Error(`EACCES: permission denied, path escapes mounted root '${path}'`);
			}
			depth -= 1;
			continue;
		}
		depth += 1;
	}
}
