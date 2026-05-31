import { describe, expect, it } from "bun:test";
import { createPatchFeature, createPatchFeatureDescription } from "@/features/patch";
import { deriveNewContentsFromChunks } from "@/features/patch/utils/apply";
import { parsePatch } from "@/features/patch/utils/parser";
import X from "@/index";

describe("createPatchFeature", () => {
	it("returns a disabled bare feature when option is false", () => {
		const feature = createPatchFeature(false);

		expect(feature.name).toBe("patch");
		expect(feature.command).toBeUndefined();
		expect(feature.description).toBeUndefined();
	});

	it("describes x-patch as the required structured file editing command", () => {
		const description = createPatchFeatureDescription();

		expect(description).toContain("IMPORTANT: YOU MUST USE x-patch");
		expect(description).toContain("x-patch [content...]");
		expect(description).toContain("x-patch <<EOF");
		expect(description).toContain("printf '%s\\n'");
		expect(description).toContain("*** Add File:");
		expect(description).toContain("*** Update File:");
		expect(description).toContain("*** Delete File:");
	});
});

describe("x-patch command", () => {
	it("adds, updates, moves, and deletes files from heredoc stdin under the current cwd", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.mkdir("/repo/src", { recursive: true });
		await x.fs.writeFile("/repo/src/app.txt", "hello\nold\nbye\n");
		await x.fs.writeFile("/repo/delete.txt", "remove me");

		const result = await x.exec(
			`x-patch <<EOF
*** Begin Patch
*** Add File: docs/readme.md
+# Title
+Body
*** Update File: src/app.txt
*** Move to: src/main.txt
@@
 hello
-old
+new
 bye
*** Delete File: delete.txt
*** End Patch
EOF`,
			{ cwd: "/repo" },
		);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toBe(
			"Success. Updated the following files:\nA docs/readme.md\nM src/main.txt\nD delete.txt\n",
		);
		expect(await x.fs.readFile("/repo/docs/readme.md")).toBe("# Title\nBody\n");
		expect(await x.fs.readFile("/repo/src/main.txt")).toBe("hello\nnew\nbye\n");
		expect(await x.fs.exists("/repo/src/app.txt")).toBe(false);
		expect(await x.fs.exists("/repo/delete.txt")).toBe(false);
	});

	it("reads a patch from piped stdin without --stdin", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });

		const result = await x.exec(
			"printf '%s\\n' '*** Begin Patch' '*** Add File: note.txt' '+hello' '*** End Patch' | x-patch",
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("A note.txt");
		expect(await x.fs.readFile("/home/user/note.txt")).toBe("hello\n");
	});

	it("supports quoted inline patches and multiple content args joined by newlines", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.writeFile("/home/user/repo.txt", "function greet()\n  return 'hi'\nend\n");

		const inline = await x.exec(
			`x-patch "*** Begin Patch
*** Update File: repo.txt
@@ function greet()
-  return 'hi'
+  return 'hello'
*** End of File
*** End Patch"`,
		);

		expect(inline.exitCode).toBe(0);
		expect(inline.stdout).toContain("M repo.txt");
		expect(await x.fs.readFile("/home/user/repo.txt")).toBe(
			"function greet()\n  return 'hello'\nend\n",
		);

		const multiArg = await x.exec(
			"x-patch '*** Begin Patch' '*** Add File: multi.txt' '+from args' '*** End Patch'",
		);

		expect(multiArg.exitCode).toBe(0);
		expect(multiArg.stdout).toContain("A multi.txt");
		expect(await x.fs.readFile("/home/user/multi.txt")).toBe("from args\n");

		await x.fs.writeFile("/home/user/dash.txt", "old\n");
		const multiArgUpdate = await x.exec(
			"x-patch '*** Begin Patch' '*** Update File: dash.txt' '@@' '-old' '+new' '*** End Patch'",
		);

		expect(multiArgUpdate.exitCode).toBe(0);
		expect(multiArgUpdate.stdout).toContain("M dash.txt");
		expect(await x.fs.readFile("/home/user/dash.txt")).toBe("new\n");
	});

	it("reports helpful usage errors for empty input, mixed sources, and removed flags", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });

		const missing = await x.exec("x-patch");
		expect(missing.exitCode).toBe(1);
		expect(missing.stderr).toContain("missing patch content");
		expect(missing.stderr).toContain("x-patch <<EOF");

		const mixed = await x.exec("x-patch inline", { stdin: "*** Begin Patch\n*** End Patch\n" });
		expect(mixed.exitCode).toBe(1);
		expect(mixed.stderr).toContain("either as arguments or stdin, not both");

		const stdinFlag = await x.exec("x-patch --stdin");
		expect(stdinFlag.exitCode).toBe(1);
		expect(stdinFlag.stderr).toContain("Nonexistent flag: --stdin");

		const fileFlag = await x.exec("x-patch --file change.patch");
		expect(fileFlag.exitCode).toBe(1);
		expect(fileFlag.stderr).toContain("Nonexistent flag: --file");

		const baseFlag = await x.exec("x-patch --base .");
		expect(baseFlag.exitCode).toBe(1);
		expect(baseFlag.stderr).toContain("Nonexistent flag: --base");
	});

	it("accepts lightly indented patch markers, headers, and a missing first @@", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.writeFile("/home/user/file.txt", "one\nold\nthree\n");

		const result = await x.exec(`x-patch "  *** Begin Patch
  *** Update File: file.txt
-old
+new
  *** End Patch  "`);

		expect(result.exitCode).toBe(0);
		expect(await x.fs.readFile("/home/user/file.txt")).toBe("one\nnew\nthree\n");
	});

	it("reports parse errors with line numbers", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });

		const unknown = await x.exec(`x-patch "*** Begin Patch
*** Nope File: a.txt
*** End Patch"`);
		expect(unknown.exitCode).toBe(1);
		expect(unknown.stderr).toContain("line 2");
		expect(unknown.stderr).toContain("not a valid hunk header");

		const emptyUpdate = await x.exec(`x-patch "*** Begin Patch
*** Update File: a.txt
*** End Patch"`);
		expect(emptyUpdate.exitCode).toBe(1);
		expect(emptyUpdate.stderr).toContain("line 2");
		expect(emptyUpdate.stderr).toContain("is empty");

		const badLine = await x.exec(`x-patch "*** Begin Patch
*** Update File: a.txt
@@
bad
*** End Patch"`);
		expect(badLine.exitCode).toBe(1);
		expect(badLine.stderr).toContain("line 4");
		expect(badLine.stderr).toContain("Unexpected line in update hunk");

		const missingEnd = await x.exec(`x-patch "*** Begin Patch
*** Add File: a.txt
+hello"`);
		expect(missingEnd.exitCode).toBe(1);
		expect(missingEnd.stderr).toContain("line 3");
		expect(missingEnd.stderr).toContain("*** End Patch");
	});

	it("reports apply failures without modifying unrelated files", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.writeFile("/home/user/repo.txt", "safe\n");

		const malformed = await x.exec('x-patch "not a patch"');
		expect(malformed.exitCode).toBe(1);
		expect(malformed.stderr).toContain("*** Begin Patch");

		const empty = await x.exec('x-patch "*** Begin Patch\n*** End Patch"');
		expect(empty.exitCode).toBe(1);
		expect(empty.stderr).toContain("empty patch");

		const badUpdate = await x.exec(`x-patch "*** Begin Patch
*** Update File: repo.txt
@@
-missing
+changed
*** End Patch"`);
		expect(badUpdate.exitCode).toBe(1);
		expect(badUpdate.stderr).toContain("Failed to find expected lines");
		expect(await x.fs.readFile("/home/user/repo.txt")).toBe("safe\n");
	});

	it("reports missing operation targets and rejects directory deletion", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.mkdir("/home/user/dir", { recursive: true });

		const missingDelete = await x.exec(`x-patch "*** Begin Patch
*** Delete File: absent.txt
*** End Patch"`);
		expect(missingDelete.exitCode).toBe(1);
		expect(missingDelete.stderr).toContain("cannot delete missing file: absent.txt");

		const missingUpdate = await x.exec(`x-patch "*** Begin Patch
*** Update File: absent.txt
@@
+hello
*** End Patch"`);
		expect(missingUpdate.exitCode).toBe(1);
		expect(missingUpdate.stderr).toContain("cannot update missing file: absent.txt");

		const deleteDirectory = await x.exec(`x-patch "*** Begin Patch
*** Delete File: dir
*** End Patch"`);
		expect(deleteDirectory.exitCode).toBe(1);
		expect(deleteDirectory.stderr).toContain("x-patch:");
		expect(await x.fs.exists("/home/user/dir")).toBe(true);
	});

	it("covers OpenCode-style empty files, no trailing newline, insert-only, and multiple chunks", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.writeFile("/home/user/empty.txt", "");
		await x.fs.writeFile("/home/user/no-newline.txt", "no newline");
		await x.fs.writeFile("/home/user/insert-only.txt", "alpha\nomega\n");
		await x.fs.writeFile("/home/user/multi-chunk.txt", "line 1\nline 2\nline 3\nline 4\n");

		const result = await x.exec(`x-patch <<EOF
*** Begin Patch
*** Update File: empty.txt
@@
+First line
*** Update File: no-newline.txt
@@
-no newline
+has newline now
*** Update File: insert-only.txt
@@
 alpha
+beta
 omega
*** Update File: multi-chunk.txt
@@
 line 1
-line 2
+LINE 2
@@
 line 3
-line 4
+LINE 4
*** End Patch
EOF`);

		expect(result.exitCode).toBe(0);
		expect(await x.fs.readFile("/home/user/empty.txt")).toBe("First line\n");
		expect(await x.fs.readFile("/home/user/no-newline.txt")).toBe("has newline now\n");
		expect(await x.fs.readFile("/home/user/insert-only.txt")).toBe("alpha\nbeta\nomega\n");
		expect(await x.fs.readFile("/home/user/multi-chunk.txt")).toBe(
			"line 1\nLINE 2\nline 3\nLINE 4\n",
		);
	});

	it("creates parents and allows add/move overwrites like OpenCode", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.mkdir("/home/user/old", { recursive: true });
		await x.fs.mkdir("/home/user/renamed/dir", { recursive: true });
		await x.fs.writeFile("/home/user/duplicate.txt", "old content\n");
		await x.fs.writeFile("/home/user/old/name.txt", "from\n");
		await x.fs.writeFile("/home/user/renamed/dir/name.txt", "existing\n");

		const result = await x.exec(`x-patch <<EOF
*** Begin Patch
*** Add File: deep/nested/file.txt
+Deep nested content
*** Add File: duplicate.txt
+new content
*** Update File: old/name.txt
*** Move to: renamed/dir/name.txt
@@
-from
+new
*** End Patch
EOF`);

		expect(result.exitCode).toBe(0);
		expect(await x.fs.readFile("/home/user/deep/nested/file.txt")).toBe("Deep nested content\n");
		expect(await x.fs.readFile("/home/user/duplicate.txt")).toBe("new content\n");
		expect(await x.fs.exists("/home/user/old/name.txt")).toBe(false);
		expect(await x.fs.readFile("/home/user/renamed/dir/name.txt")).toBe("new\n");
	});

	it("uses @@ context and EOF anchors to disambiguate repeated matches", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.writeFile("/home/user/multi-ctx.txt", "fn a\nx=10\ny=2\nfn b\nx=10\ny=20\n");
		await x.fs.writeFile("/home/user/eof-anchor.txt", "start\nmarker\nmiddle\nmarker\nend\n");

		const result = await x.exec(`x-patch <<EOF
*** Begin Patch
*** Update File: multi-ctx.txt
@@ fn b
-x=10
+x=11
*** Update File: eof-anchor.txt
@@
-marker
-end
+marker-changed
+end
*** End of File
*** End Patch
EOF`);

		expect(result.exitCode).toBe(0);
		expect(await x.fs.readFile("/home/user/multi-ctx.txt")).toBe(
			"fn a\nx=10\ny=2\nfn b\nx=11\ny=20\n",
		);
		expect(await x.fs.readFile("/home/user/eof-anchor.txt")).toBe(
			"start\nmarker\nmiddle\nmarker-changed\nend\n",
		);
	});

	it("leaves no side effects when a later hunk cannot be verified", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });

		const result = await x.exec(`x-patch <<EOF
*** Begin Patch
*** Add File: created.txt
+hello
*** Update File: missing.txt
@@
-old
+new
*** End Patch
EOF`);

		expect(result.exitCode).toBe(1);
		expect(await x.fs.exists("/home/user/created.txt")).toBe(false);
	});
});

describe("patch parser and apply helpers", () => {
	it("strips literal heredoc wrappers and parses indented headers", () => {
		const xPatchWrapped = parsePatch(`x-patch <<'EOF'
  *** Begin Patch
  *** Add File: a.txt
+hello
  *** End Patch
EOF`);

		const catWrapped = parsePatch(`cat <<'PATCH'
*** Begin Patch
*** Add File: b.txt
+cat heredoc
*** End Patch
PATCH`);

		const bareWrapped = parsePatch(`<<EOF
*** Begin Patch
*** Add File: c.txt
+bare heredoc
*** End Patch
EOF`);

		expect(xPatchWrapped.hunks).toEqual([{ type: "add", path: "a.txt", contents: "hello" }]);
		expect(catWrapped.hunks).toEqual([{ type: "add", path: "b.txt", contents: "cat heredoc" }]);
		expect(bareWrapped.hunks).toEqual([{ type: "add", path: "c.txt", contents: "bare heredoc" }]);
	});

	it("generates unified diffs using the diff dependency", () => {
		const result = deriveNewContentsFromChunks(
			"file.txt",
			[
				{
					oldLines: ["old"],
					newLines: ["new"],
				},
			],
			"old\n",
		);

		expect(result.content).toBe("new\n");
		expect(result.originalContent).toBe("old\n");
		expect(result.unifiedDiff).toContain("--- file.txt");
		expect(result.unifiedDiff).toContain("+++ file.txt");
		expect(result.unifiedDiff).toContain("-old");
		expect(result.unifiedDiff).toContain("+new");
	});

	it("matches EOF, Unicode punctuation, trim differences, and preserves BOM", () => {
		const eof = deriveNewContentsFromChunks(
			"tail.txt",
			[
				{
					oldLines: ["tail"],
					newLines: ["done"],
					isEndOfFile: true,
				},
			],
			"head\ntail\n",
		);
		expect(eof.content).toBe("head\ndone\n");

		const unicode = deriveNewContentsFromChunks(
			"unicode.txt",
			[
				{
					oldLines: ['const label = "a-b";'],
					newLines: ['const label = "a-b-c";'],
				},
			],
			"const label = “a‑b”;\n",
		);
		expect(unicode.content).toBe('const label = "a-b-c";\n');

		const trimmed = deriveNewContentsFromChunks(
			"trim.txt",
			[
				{
					oldLines: ["value"],
					newLines: ["next"],
				},
			],
			"  value  \n",
		);
		expect(trimmed.content).toBe("next\n");

		const bom = deriveNewContentsFromChunks(
			"bom.txt",
			[
				{
					oldLines: ["old"],
					newLines: ["new"],
				},
			],
			"\uFEFFold\n",
		);
		expect(bom.bom).toBe(true);
		expect(bom.content).toBe("new\n");
	});
});
