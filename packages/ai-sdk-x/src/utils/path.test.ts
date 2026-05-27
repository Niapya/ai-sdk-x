import { describe, expect, it } from "bun:test";
import {
	descendantPrefix,
	dirname,
	joinPath,
	normalizePath,
	parentPaths,
	resolvePath,
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
});
