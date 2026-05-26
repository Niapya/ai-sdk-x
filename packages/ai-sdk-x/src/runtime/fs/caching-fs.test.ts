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
import { CachingFs } from "@/runtime/fs/caching-fs";

describe("CachingFs", () => {
	it("caches readFile and stat until ttl expiry", async () => {
		let now = 0;
		const tracked = new TrackingFs({ "/repo/file.txt": "hello" });
		const fs = new CachingFs({
			fs: tracked,
			now: () => now,
			readFileTtlMs: 100,
			statTtlMs: 100,
		});

		expect(await fs.readFile("/repo/file.txt")).toBe("hello");
		expect(await fs.readFile("/repo/file.txt")).toBe("hello");
		expect(tracked.calls.readFile).toBe(1);

		expect((await fs.stat("/repo/file.txt")).size).toBe(5);
		expect((await fs.stat("/repo/file.txt")).size).toBe(5);
		expect(tracked.calls.stat).toBe(1);

		now = 200;
		expect(await fs.readFile("/repo/file.txt")).toBe("hello");
		expect(tracked.calls.readFile).toBe(2);
	});

	it("caches binary reads and readFileBytes", async () => {
		const tracked = new TrackingFs({
			"/repo/data.bin": new Uint8Array([1, 2, 3]),
		});
		const fs = new CachingFs({ fs: tracked, ttlMs: 1_000 });

		expect(Array.from(await fs.readFileBuffer("/repo/data.bin"))).toEqual([1, 2, 3]);
		expect(Array.from(await fs.readFileBuffer("/repo/data.bin"))).toEqual([1, 2, 3]);
		expect(tracked.calls.readFileBuffer).toBe(1);

		const firstBytes = await fs.readFileBytes("/repo/data.bin");
		const secondBytes = await fs.readFileBytes("/repo/data.bin");
		expect(firstBytes).toBe(secondBytes);
		expect(tracked.calls.readFileBytes).toBe(1);
	});

	it("negative-caches missing entries for a short ttl", async () => {
		let now = 0;
		const tracked = new TrackingFs();
		const fs = new CachingFs({
			fs: tracked,
			now: () => now,
			negativeTtlMs: 50,
			statTtlMs: 500,
		});

		await expect(fs.stat("/repo/missing.txt")).rejects.toThrow("ENOENT");
		await expect(fs.stat("/repo/missing.txt")).rejects.toThrow("ENOENT");
		expect(tracked.calls.stat).toBe(1);

		now = 75;
		await expect(fs.stat("/repo/missing.txt")).rejects.toThrow("ENOENT");
		expect(tracked.calls.stat).toBe(2);
	});

	it("invalidates file and parent directory caches after writes", async () => {
		const tracked = new TrackingFs({
			"/repo/a.txt": "a",
		});
		const fs = new CachingFs({ fs: tracked, ttlMs: 1_000 });

		expect(await fs.readdir("/repo")).toEqual(["a.txt"]);
		expect(await fs.readFile("/repo/a.txt")).toBe("a");

		await fs.writeFile("/repo/b.txt", "b");

		expect(await fs.readdir("/repo")).toEqual(["a.txt", "b.txt"]);
		expect(await fs.readFile("/repo/b.txt")).toBe("b");
		expect(tracked.calls.readdir).toBe(2);
	});

	it("drops negative cache entries when a missing path is created", async () => {
		const tracked = new TrackingFs();
		const fs = new CachingFs({ fs: tracked, ttlMs: 1_000, negativeTtlMs: 1_000 });

		await expect(fs.stat("/repo/new.txt")).rejects.toThrow("ENOENT");
		await fs.writeFile("/repo/new.txt", "new");

		expect((await fs.stat("/repo/new.txt")).size).toBe(3);
	});

	it("invalidates source and destination directories after mv", async () => {
		const tracked = new TrackingFs({
			"/repo/source/a.txt": "a",
		});
		const fs = new CachingFs({ fs: tracked, ttlMs: 1_000 });

		expect(await fs.readdir("/repo/source")).toEqual(["a.txt"]);
		await fs.mv("/repo/source/a.txt", "/repo/dest/a.txt");

		expect(await fs.readdir("/repo/source")).toEqual([]);
		expect(await fs.readdir("/repo/dest")).toEqual(["a.txt"]);
	});

	it("evicts old entries when maxBytes is exceeded", async () => {
		const tracked = new TrackingFs({
			"/repo/one.txt": "1111",
			"/repo/two.txt": "2222",
		});
		const fs = new CachingFs({ fs: tracked, ttlMs: 1_000, maxBytes: 60 });

		expect(await fs.readFile("/repo/one.txt")).toBe("1111");
		expect(await fs.readFile("/repo/two.txt")).toBe("2222");
		expect(await fs.readFile("/repo/one.txt")).toBe("1111");

		expect(tracked.calls.readFile).toBeGreaterThanOrEqual(3);
	});
});

class TrackingFs implements IFileSystem {
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

	private readonly fs: InMemoryFs;

	constructor(initialFiles?: Record<string, FileContent>) {
		this.fs = new InMemoryFs(initialFiles);
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
