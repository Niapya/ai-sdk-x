import { describe, expect, it } from "bun:test";
import { deriveNewContentsFromChunks, parsePatch, patch } from "@/features/patch/patch";

describe("parsePatch", () => {
	it("parses an Add File hunk", () => {
		const text = "*** Begin Patch\n*** Add File: src/new.ts\n+export const x = 1;\n*** End Patch";
		const { hunks } = parsePatch(text);
		expect(hunks.length).toBe(1);
		expect(hunks[0].type).toBe("add");
		if (hunks[0].type === "add") {
			expect(hunks[0].path).toBe("src/new.ts");
			expect(hunks[0].contents).toContain("export const x = 1;");
		}
	});

	it("parses a Delete File hunk", () => {
		const text = "*** Begin Patch\n*** Delete File: old.ts\n*** End Patch";
		const { hunks } = parsePatch(text);
		expect(hunks.length).toBe(1);
		expect(hunks[0].type).toBe("delete");
		if (hunks[0].type === "delete") {
			expect(hunks[0].path).toBe("old.ts");
		}
	});

	it("parses an Update File hunk with chunks", () => {
		const text = [
			"*** Begin Patch",
			"*** Update File: main.ts",
			"@@",
			"-const a = 1;",
			"+const a = 2;",
			"*** End Patch",
		].join("\n");
		const { hunks } = parsePatch(text);
		expect(hunks.length).toBe(1);
		expect(hunks[0].type).toBe("update");
		if (hunks[0].type === "update") {
			expect(hunks[0].path).toBe("main.ts");
			expect(hunks[0].chunks.length).toBe(1);
			expect(hunks[0].chunks[0].old_lines).toEqual(["const a = 1;"]);
			expect(hunks[0].chunks[0].new_lines).toEqual(["const a = 2;"]);
		}
	});

	it("parses a Move-to update hunk", () => {
		const text = [
			"*** Begin Patch",
			"*** Update File: src/old.ts",
			"*** Move to: src/new.ts",
			"@@",
			" keep",
			"*** End Patch",
		].join("\n");
		const { hunks } = parsePatch(text);
		expect(hunks[0].type).toBe("update");
		if (hunks[0].type === "update") {
			expect(hunks[0].move_path).toBe("src/new.ts");
		}
	});

	it("parses multiple hunks in one patch", () => {
		const text = [
			"*** Begin Patch",
			"*** Add File: a.ts",
			"+const a = 1;",
			"*** Delete File: b.ts",
			"*** End Patch",
		].join("\n");
		const { hunks } = parsePatch(text);
		expect(hunks.length).toBe(2);
		expect(hunks[0].type).toBe("add");
		expect(hunks[1].type).toBe("delete");
	});

	it("returns 0 hunks for empty Begin/End Patch", () => {
		const text = "*** Begin Patch\n*** End Patch";
		const { hunks } = parsePatch(text);
		expect(hunks.length).toBe(0);
	});

	it("throws when Begin marker is missing", () => {
		expect(() => parsePatch("*** End Patch\n")).toThrow();
	});

	it("throws when End marker is missing", () => {
		expect(() => parsePatch("*** Begin Patch\n")).toThrow();
	});

	it("strips heredoc wrapper before parsing", () => {
		const heredoc =
			"cat <<'EOF'\n*** Begin Patch\n*** Add File: x.ts\n+const y=1;\n*** End Patch\nEOF";
		const { hunks } = parsePatch(heredoc);
		expect(hunks[0].type).toBe("add");
	});
});

describe("patch – add", () => {
	it("sets content to the added lines", () => {
		const text = "*** Begin Patch\n*** Add File: new.ts\n+const x = 1;\n*** End Patch";
		const result = patch("", text);
		expect(result).toContain("const x = 1;");
	});

	it("preserves an empty added file", () => {
		const text = "*** Begin Patch\n*** Add File: empty.ts\n*** End Patch";
		const result = patch("", text);
		expect(result).toBe("");
	});
});

describe("patch – delete", () => {
	it("returns empty string for a deleted file", () => {
		const text = "*** Begin Patch\n*** Delete File: old.ts\n*** End Patch";
		const result = patch("some content", text);
		expect(result).toBe("");
	});
});

describe("patch – update", () => {
	it("replaces matched old lines with new lines", () => {
		const original = "const a = 1;\nconst b = 2;\n";
		const text = [
			"*** Begin Patch",
			"*** Update File: main.ts",
			"@@",
			"-const a = 1;",
			"+const a = 100;",
			"*** End Patch",
		].join("\n");
		const result = patch(original, text);
		expect(result).toContain("const a = 100;");
		expect(result).toContain("const b = 2;");
	});

	it("throws when old lines not found in the original", () => {
		const original = "const x = 1;\n";
		const text = [
			"*** Begin Patch",
			"*** Update File: main.ts",
			"@@",
			"-missing line",
			"+replacement",
			"*** End Patch",
		].join("\n");
		expect(() => patch(original, text)).toThrow();
	});

	it("throws for empty patch (no hunks)", () => {
		expect(() => patch("", "*** Begin Patch\n*** End Patch")).toThrow();
	});
});

describe("deriveNewContentsFromChunks", () => {
	it("applies exact match on old_lines", () => {
		const orig = "line A\nline B\nline C\n";
		const chunks = [{ old_lines: ["line B"], new_lines: ["line B modified"] }];
		const result = deriveNewContentsFromChunks("file.ts", chunks, orig);
		expect(result.content).toContain("line B modified");
	});

	it("applies rstrip-based fuzzy match", () => {
		const orig = "  padded  \nline B\n";
		const chunks = [{ old_lines: ["  padded"], new_lines: ["stripped"] }];
		// rstrip match: orig line rstripped matches old_line
		const result = deriveNewContentsFromChunks("file.ts", chunks, orig);
		expect(result.content).toContain("stripped");
	});

	it("keeps context lines unchanged", () => {
		const orig = "ctx\ntarget\nctx2\n";
		const chunks = [{ old_lines: ["ctx", "target"], new_lines: ["ctx", "replaced"] }];
		const result = deriveNewContentsFromChunks("file.ts", chunks, orig);
		expect(result.content).toContain("ctx");
		expect(result.content).toContain("replaced");
	});
});
