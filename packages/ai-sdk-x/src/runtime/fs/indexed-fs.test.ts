import { describe, expect, it } from "bun:test";
import type {
	CpOptions,
	FileContent,
	FsStat,
	IFileSystem,
	MkdirOptions,
	RmOptions,
} from "just-bash";
import { InMemoryFs } from "just-bash";
import { IndexedFs } from "@/runtime/fs/indexed-fs";

describe("IndexedFs", () => {
	it("serves stat and readdir from the manifest without scanning the base fs", async () => {
		const tracked = new IndexedTrackingFs();
		const fs = new IndexedFs({ fs: tracked });

		await fs.mkdir("/repo", { recursive: true });
		await fs.writeFile("/repo/a.txt", "a");
		await fs.writeFile("/repo/b.txt", "bb");

		tracked.reset();

		expect(await fs.readdir("/repo")).toEqual(["a.txt", "b.txt"]);
		expect((await fs.stat("/repo/b.txt")).size).toBe(2);
		expect(tracked.calls.readdir).toBe(0);
		expect(tracked.calls.stat).toBe(0);
	});

	it("updates subtree manifest after cp mv and rm", async () => {
		const tracked = new IndexedTrackingFs();
		const fs = new IndexedFs({ fs: tracked });

		await fs.mkdir("/repo/source/nested", { recursive: true });
		await fs.writeFile("/repo/source/file.txt", "hello");
		await fs.writeFile("/repo/source/nested/child.txt", "child");

		await fs.cp("/repo/source", "/repo/copied", { recursive: true });
		expect(await fs.readdir("/repo/copied")).toEqual(["file.txt", "nested"]);

		await fs.mv("/repo/copied", "/repo/moved");
		expect(await fs.readdir("/repo/moved")).toEqual(["file.txt", "nested"]);
		await expect(fs.stat("/repo/copied/file.txt")).rejects.toThrow("ENOENT");

		await fs.rm("/repo/moved", { recursive: true });
		await expect(fs.stat("/repo/moved/file.txt")).rejects.toThrow("ENOENT");
	});

	it("delegates content reads to the base fs once the path is indexed", async () => {
		const tracked = new IndexedTrackingFs();
		const fs = new IndexedFs({ fs: tracked });

		await fs.writeFile("/repo/file.txt", "hello");
		tracked.reset();

		expect(await fs.readFile("/repo/file.txt")).toBe("hello");
		expect(tracked.calls.readFile).toBe(1);
	});

	it("updates indexed metadata after appendFile and exposes dirents from the manifest", async () => {
		const tracked = new IndexedTrackingFs();
		const fs = new IndexedFs({ fs: tracked });

		await fs.writeFile("/repo/file.txt", "a");
		await fs.appendFile("/repo/file.txt", "bc");

		expect((await fs.stat("/repo/file.txt")).size).toBe(3);
		expect(await fs.readdirWithFileTypes("/repo")).toEqual([
			{
				name: "file.txt",
				isFile: true,
				isDirectory: false,
				isSymbolicLink: false,
			},
		]);
	});
});

class IndexedTrackingFs implements IFileSystem {
	readonly calls = {
		appendFile: 0,
		chmod: 0,
		cp: 0,
		exists: 0,
		link: 0,
		lstat: 0,
		mkdir: 0,
		mv: 0,
		readFile: 0,
		readFileBuffer: 0,
		readFileBytes: 0,
		readdir: 0,
		readdirWithFileTypes: 0,
		readlink: 0,
		realpath: 0,
		rm: 0,
		stat: 0,
		symlink: 0,
		utimes: 0,
		writeFile: 0,
	};

	private readonly fs = new InMemoryFs();

	reset(): void {
		for (const key of Object.keys(this.calls) as Array<keyof typeof this.calls>) {
			this.calls[key] = 0;
		}
	}

	async readFile(path: string, options?: Parameters<IFileSystem["readFile"]>[1]): Promise<string> {
		this.calls.readFile += 1;
		return this.fs.readFile(path, options);
	}

	async readFileBytes(path: string) {
		this.calls.readFileBytes += 1;
		return this.fs.readFileBytes(path);
	}

	async readFileBuffer(path: string): Promise<Uint8Array> {
		this.calls.readFileBuffer += 1;
		return this.fs.readFileBuffer(path);
	}

	async writeFile(
		path: string,
		content: FileContent,
		options?: Parameters<IFileSystem["writeFile"]>[2],
	): Promise<void> {
		this.calls.writeFile += 1;
		return this.fs.writeFile(path, content, options);
	}

	async appendFile(
		path: string,
		content: FileContent,
		options?: Parameters<IFileSystem["appendFile"]>[2],
	): Promise<void> {
		this.calls.appendFile += 1;
		return this.fs.appendFile(path, content, options);
	}

	async exists(path: string): Promise<boolean> {
		this.calls.exists += 1;
		return this.fs.exists(path);
	}

	async stat(path: string): Promise<FsStat> {
		this.calls.stat += 1;
		return this.fs.stat(path);
	}

	async mkdir(path: string, options?: MkdirOptions): Promise<void> {
		this.calls.mkdir += 1;
		return this.fs.mkdir(path, options);
	}

	async readdir(path: string): Promise<string[]> {
		this.calls.readdir += 1;
		return this.fs.readdir(path);
	}

	async readdirWithFileTypes(path: string) {
		this.calls.readdirWithFileTypes += 1;
		return this.fs.readdirWithFileTypes(path);
	}

	async rm(path: string, options?: RmOptions): Promise<void> {
		this.calls.rm += 1;
		return this.fs.rm(path, options);
	}

	async cp(src: string, dest: string, options?: CpOptions): Promise<void> {
		this.calls.cp += 1;
		return this.fs.cp(src, dest, options);
	}

	async mv(src: string, dest: string): Promise<void> {
		this.calls.mv += 1;
		return this.fs.mv(src, dest);
	}

	resolvePath(base: string, path: string): string {
		return this.fs.resolvePath(base, path);
	}

	getAllPaths(): string[] {
		return this.fs.getAllPaths();
	}

	async chmod(path: string, mode: number): Promise<void> {
		this.calls.chmod += 1;
		return this.fs.chmod(path, mode);
	}

	async symlink(target: string, linkPath: string): Promise<void> {
		this.calls.symlink += 1;
		return this.fs.symlink(target, linkPath);
	}

	async link(existingPath: string, newPath: string): Promise<void> {
		this.calls.link += 1;
		return this.fs.link(existingPath, newPath);
	}

	async readlink(path: string): Promise<string> {
		this.calls.readlink += 1;
		return this.fs.readlink(path);
	}

	async lstat(path: string): Promise<FsStat> {
		this.calls.lstat += 1;
		return this.fs.lstat(path);
	}

	async realpath(path: string): Promise<string> {
		this.calls.realpath += 1;
		return this.fs.realpath(path);
	}

	async utimes(path: string, atime: Date, mtime: Date): Promise<void> {
		this.calls.utimes += 1;
		return this.fs.utimes(path, atime, mtime);
	}
}
