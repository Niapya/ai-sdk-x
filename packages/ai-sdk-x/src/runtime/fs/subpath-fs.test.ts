import { describe, expect, it } from "bun:test";
import { InMemoryFs } from "just-bash";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";

describe("SubpathFs", () => {
	it("reads and writes relative to the mounted root", async () => {
		const base = new InMemoryFs({
			"/workspace/project/notes/todo.txt": "before",
		});
		const fs = createSubpathFs(base, "/workspace/project");

		expect(await fs.readFile("/notes/todo.txt")).toBe("before");

		await fs.writeFile("/notes/todo.txt", "after");
		await fs.appendFile("/notes/todo.txt", "\nmore");

		expect(await fs.readFile("/notes/todo.txt")).toBe("after\nmore");
		expect(await base.readFile("/workspace/project/notes/todo.txt")).toBe("after\nmore");
	});

	it("creates, copies, moves, and removes files under the mounted root", async () => {
		const base = new InMemoryFs();
		const fs = createSubpathFs(base, "/workspace/project");

		await fs.mkdir("/src", { recursive: true });
		await fs.writeFile("/src/index.ts", "export const value = 1;");
		await fs.cp("/src/index.ts", "/src/copy.ts");
		await fs.mv("/src/copy.ts", "/dist/index.ts");

		expect(await base.readFile("/workspace/project/src/index.ts")).toContain("value");
		expect(await base.readFile("/workspace/project/dist/index.ts")).toContain("value");

		await fs.rm("/src/index.ts");
		expect(await fs.exists("/src/index.ts")).toBe(false);
		expect(await base.exists("/workspace/project/src/index.ts")).toBe(false);
	});

	it("translates absolute symlink targets back into mounted paths while keeping relative targets", async () => {
		const base = new InMemoryFs({
			"/workspace/project/docs/readme.md": "hello",
		});
		const fs = createSubpathFs(base, "/workspace/project");

		await fs.symlink("/docs/readme.md", "/docs/absolute-link.md");
		await fs.symlink("readme.md", "/docs/relative-link.md");

		expect(await base.readlink("/workspace/project/docs/absolute-link.md")).toBe(
			"/workspace/project/docs/readme.md",
		);
		expect(await fs.readlink("/docs/absolute-link.md")).toBe("/docs/readme.md");

		expect(await base.readlink("/workspace/project/docs/relative-link.md")).toBe("readme.md");
		expect(await fs.readlink("/docs/relative-link.md")).toBe("readme.md");
	});

	it("returns mounted paths from getAllPaths and filters entries outside the root", async () => {
		const base = new InMemoryFs({
			"/workspace/project/src/index.ts": "export {}",
			"/workspace/project/src/nested/file.txt": "nested",
			"/workspace/other/ignored.txt": "ignored",
		});
		const fs = createSubpathFs(base, "/workspace/project");

		expect(fs.getAllPaths()).toEqual([
			"/",
			"/src",
			"/src/index.ts",
			"/src/nested",
			"/src/nested/file.txt",
		]);
	});

	it("rejects realpath results that escape the mounted root", async () => {
		const base = new InMemoryFs({
			"/workspace/project/inside.txt": "inside",
			"/workspace/outside.txt": "outside",
		});
		const fs = createSubpathFs(base, "/workspace/project");

		await base.symlink("/workspace/project/inside.txt", "/workspace/project/inside-link.txt");
		await base.symlink("/workspace/outside.txt", "/workspace/project/outside-link.txt");

		expect(await fs.realpath("/inside-link.txt")).toBe("/inside.txt");
		await expect(fs.realpath("/outside-link.txt")).rejects.toThrow("EACCES");
	});

	it("rejects input paths that escape the mounted root", async () => {
		const base = new InMemoryFs({
			"/workspace/project/secret.txt": "not reachable by ../secret.txt",
		});
		const fs = createSubpathFs(base, "/workspace/project");

		await expect(fs.readFile("../secret.txt")).rejects.toThrow("EACCES");
		await expect(fs.writeFile("/../../secret.txt", "x")).rejects.toThrow("EACCES");
		expect(await fs.readFile("/secret.txt")).toBe("not reachable by ../secret.txt");
	});

	it("maps metadata, hard links, buffers, and timestamps through the mounted root", async () => {
		const base = new InMemoryFs({
			"/workspace/project/file.txt": "abc",
		});
		const fs = createSubpathFs(base, "/workspace/project");
		const mtime = new Date("2026-03-04T05:06:07.000Z");

		expect(Array.from(await fs.readFileBuffer("/file.txt"))).toEqual([97, 98, 99]);
		expect((await fs.stat("/file.txt")).size).toBe(3);
		expect(await fs.readdir("/")).toEqual(["file.txt"]);

		await fs.chmod("/file.txt", 0o600);
		expect((await fs.lstat("/file.txt")).mode).toBe(0o600);

		await fs.utimes("/file.txt", mtime, mtime);
		expect((await base.stat("/workspace/project/file.txt")).mtime.toISOString()).toBe(
			mtime.toISOString(),
		);

		await fs.link("/file.txt", "/copy.txt");
		expect(await fs.readFile("/copy.txt")).toBe("abc");
		expect(await base.readFile("/workspace/project/copy.txt")).toBe("abc");
	});

	it("acts as a transparent view when mounted at filesystem root", async () => {
		const base = new InMemoryFs({
			"/file.txt": "root",
		});
		const fs = createSubpathFs(base, "/");

		expect(fs.getAllPaths()).toContain("/file.txt");
		await fs.writeFile("/nested/file.txt", "nested");
		expect(await base.readFile("/nested/file.txt")).toBe("nested");
	});
});
