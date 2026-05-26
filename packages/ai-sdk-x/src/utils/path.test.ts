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
