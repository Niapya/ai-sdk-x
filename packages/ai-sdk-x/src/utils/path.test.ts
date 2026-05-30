import { describe, expect, it } from "bun:test";
import { type ByteString, type CommandContext, InMemoryFs, unsafeBytesFromLatin1 } from "just-bash";
import {
	descendantPrefix,
	dirname,
	getCommandCwd,
	joinPath,
	normalizePath,
	parentPaths,
	resolveCliPath,
	resolvePath,
	resolveSymlinkTarget,
	validatePath,
} from "@/utils/path";

describe("path utils", () => {
	it("normalizes relative and dotted paths", () => {
		expect(normalizePath("repo/./src/../file.txt")).toBe("/repo/file.txt");
		expect(normalizePath("/repo/")).toBe("/repo");
		expect(normalizePath("/../../repo")).toBe("/repo");
	});

	it("builds parent and descendant relationships", () => {
		expect(dirname("/repo/src/file.txt")).toBe("/repo/src");
		expect(parentPaths("/repo/src/file.txt")).toEqual(["/repo/src", "/repo", "/"]);
		expect(descendantPrefix("/repo")).toBe("/repo/");
	});

	it("joins and resolves virtual paths", () => {
		expect(joinPath("/repo", "file.txt")).toBe("/repo/file.txt");
		expect(resolvePath("/repo/src", "../file.txt")).toBe("/repo/file.txt");
		expect(resolvePath("/repo/src", "/tmp/out.txt")).toBe("/tmp/out.txt");
	});
});

describe("path utils – edge cases", () => {
	it("normalizePath: trailing slash on root stays as /", () => {
		expect(normalizePath("/")).toBe("/");
	});

	it("normalizePath: empty string becomes /", () => {
		expect(normalizePath("")).toBe("/");
	});

	it("normalizePath: repeated ../ beyond root clamps to /", () => {
		expect(normalizePath("/../../..")).toBe("/");
	});

	it("normalizePath: double slashes are collapsed", () => {
		expect(normalizePath("/a//b//c")).toBe("/a/b/c");
	});

	it("dirname: root dir returns /", () => {
		expect(dirname("/")).toBe("/");
	});

	it("dirname: top-level file returns /", () => {
		expect(dirname("/file.txt")).toBe("/");
	});

	it("parentPaths: / has no parents", () => {
		expect(parentPaths("/")).toEqual([]);
	});

	it("parentPaths: direct child of root returns ['/']", () => {
		expect(parentPaths("/file.txt")).toEqual(["/"]);
	});

	it("joinPath: relative child appended under non-root parent", () => {
		expect(joinPath("/base", "child")).toBe("/base/child");
	});

	it("joinPath: child appended under root parent", () => {
		expect(joinPath("/", "file.txt")).toBe("/file.txt");
	});

	it("resolvePath: same directory (.) stays at base dir", () => {
		expect(resolvePath("/base/dir", ".")).toBe("/base/dir");
	});

	it("validatePath: rejects null bytes", () => {
		expect(() => validatePath("/safe/path", "open")).not.toThrow();
		expect(() => validatePath("/unsafe\0path", "open")).toThrow(
			"ENOENT: path contains null byte, open '/unsafe",
		);
	});

	it("resolveSymlinkTarget: resolves absolute and relative targets", () => {
		expect(resolveSymlinkTarget("/repo/docs/link.md", "/shared/readme.md")).toBe(
			"/shared/readme.md",
		);
		expect(resolveSymlinkTarget("/repo/docs/link.md", "../readme.md")).toBe("/repo/readme.md");
	});
});

describe("CLI path resolution", () => {
	it("resolves relative and absolute paths after shell expansion", () => {
		const ctx = createCommandContext({ cwd: "/work/project", home: "/home/custom" });

		expect(resolveCliPath("src/index.ts", ctx)).toBe("/work/project/src/index.ts");
		expect(resolveCliPath("../README.md", ctx)).toBe("/work/README.md");
		expect(resolveCliPath("/tmp/file.txt", ctx)).toBe("/tmp/file.txt");
		expect(resolveCliPath("/home/custom/notes/todo.md", ctx)).toBe("/home/custom/notes/todo.md");
	});

	it("resolves relative paths from an explicit base path", () => {
		const ctx = createCommandContext({ cwd: "/work/project", home: "/home/custom" });

		expect(resolveCliPath("src/index.ts", ctx, "/workspace")).toBe("/workspace/src/index.ts");
		expect(resolveCliPath("/tmp/file.txt", ctx, "/workspace")).toBe("/tmp/file.txt");
		expect(resolveCliPath("/home/custom/notes/todo.md", ctx, "/workspace")).toBe(
			"/home/custom/notes/todo.md",
		);
	});

	it("falls back to default cwd when context cwd is missing", () => {
		const ctx = createCommandContext({});

		expect(getCommandCwd({ ...ctx, cwd: undefined as unknown as string })).toBe("/home/user");
		expect(resolveCliPath("file.txt", { ...ctx, cwd: undefined as unknown as string })).toBe(
			"/home/user/file.txt",
		);
	});
});

function createCommandContext(options: { cwd?: string; home?: string }): CommandContext {
	return {
		cwd: options.cwd ?? "/home/user",
		env: new Map([["HOME", options.home ?? "/home/user"]]),
		fs: new InMemoryFs(),
		stdin: unsafeBytesFromLatin1("") as ByteString,
	};
}
