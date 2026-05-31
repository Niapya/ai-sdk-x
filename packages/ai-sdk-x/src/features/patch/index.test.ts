import { describe, expect, it } from "bun:test";
import { createPatchFeature, createPatchFeatureDescription } from "@/features/patch";
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

		expect(description).toContain("IMPORTANT: YOU MUST USE `x-patch`");
		expect(description).toContain("*** Add File:");
		expect(description).toContain("*** Update File:");
		expect(description).toContain("*** Delete File:");
	});
});

describe("x-patch command", () => {
	it("adds, updates, moves, and deletes files from stdin under the current cwd", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.mkdir("/repo/src", { recursive: true });
		await x.fs.writeFile("/repo/src/app.txt", "hello\nold\nbye\n");
		await x.fs.writeFile("/repo/delete.txt", "remove me");

		const result = await x.exec("x-patch", {
			cwd: "/repo",
			stdin: `*** Begin Patch
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
`,
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toBe(
			"A docs/readme.md\nM src/main.txt (from src/app.txt)\nD delete.txt\n",
		);
		expect(await x.fs.readFile("/repo/docs/readme.md")).toBe("# Title\nBody");
		expect(await x.fs.readFile("/repo/src/main.txt")).toBe("hello\nnew\nbye\n");
		expect(await x.fs.exists("/repo/src/app.txt")).toBe(false);
		expect(await x.fs.exists("/repo/delete.txt")).toBe(false);
	});

	it("reads a patch from --file and resolves paths against --base", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.mkdir("/repo/patches", { recursive: true });
		await x.fs.writeFile(
			"/repo/patches/change.patch",
			`*** Begin Patch
*** Add File: nested/file.txt
+from patch file
*** End Patch
`,
		);

		const result = await x.exec("x-patch --file patches/change.patch --base ./workspace", {
			cwd: "/repo",
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toBe("A nested/file.txt\n");
		expect(await x.fs.readFile("/repo/workspace/nested/file.txt")).toBe("from patch file");
	});

	it("supports inline patches, context headers, and end-of-file matching", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.writeFile("/home/user/repo.txt", "function greet()\n  return 'hi'\nend\n");

		const result = await x.exec(
			`x-patch "*** Begin Patch
*** Update File: repo.txt
@@ function greet()
-  return 'hi'
+  return 'hello'
*** End of File
*** End Patch"`,
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("M repo.txt\n");
		expect(await x.fs.readFile("/home/user/repo.txt")).toBe(
			"function greet()\n  return 'hello'\nend\n",
		);
	});

	it("reports usage errors for missing or multiple patch sources", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });

		const missing = await x.exec("x-patch");
		expect(missing.exitCode).toBe(1);
		expect(missing.stderr).toContain("missing inline content, --file, or stdin");

		await x.fs.writeFile("/change.patch", "*** Begin Patch\n*** End Patch\n");
		const multiple = await x.exec("x-patch inline --file /change.patch");
		expect(multiple.exitCode).toBe(1);
		expect(multiple.stderr).toContain("not multiple sources");
	});

	it("reports parse and apply failures without modifying unrelated files", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });
		await x.fs.writeFile("/home/user/repo.txt", "safe\n");

		const malformed = await x.exec('x-patch "not a patch"');
		expect(malformed.exitCode).toBe(1);
		expect(malformed.stderr).toContain("Invalid patch format");

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

	it("reports missing patch files and missing operation targets", async () => {
		const x = X.init({ git: false, memory: false, skills: false, workspace: false });

		const missingFile = await x.exec("x-patch --file missing.patch");
		expect(missingFile.exitCode).toBe(1);
		expect(missingFile.stderr).toContain("patch file not found: missing.patch");

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
	});
});
