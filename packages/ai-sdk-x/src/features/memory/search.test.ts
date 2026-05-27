import { describe, expect, it } from "bun:test";
import { InMemoryFs } from "just-bash";
import { searchMemory } from "@/features/memory/search";

const MOUNT = "/home/user/memory";

describe("searchMemory", () => {
	it("returns exitCode 1 for empty query", async () => {
		const fs = new InMemoryFs();
		const result = await searchMemory("", fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("missing query");
	});

	it("returns exitCode 1 for whitespace-only query", async () => {
		const fs = new InMemoryFs();
		const result = await searchMemory("   \n\t", fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(1);
	});

	it("returns empty stdout when no files match", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/MEMORY.md`]: "# Memory\n\nsome content here\n",
		});
		const result = await searchMemory("zzz-no-match", fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});

	it("matches case-insensitively", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/MEMORY.md`]: "# Memory\n\nHello World\n",
		});
		const result = await searchMemory("hello world", fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Hello World");
	});

	it("outputs format path:lineNumber:content", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/MEMORY.md`]: "line one\nfind me here\nline three\n",
		});
		const result = await searchMemory("find me", fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(0);
		const lines = result.stdout.trim().split("\n");
		expect(lines.length).toBe(1);
		// line 2 (1-based)
		expect(lines[0]).toMatch(/^.*MEMORY\.md:2:find me here$/);
	});

	it("matches multiple lines in a single file", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/MEMORY.md`]: "match 1\nno\nmatch 2\n",
		});
		const result = await searchMemory("match", fs, { mountPoint: MOUNT });
		const lines = result.stdout.trim().split("\n");
		expect(lines.length).toBe(2);
		expect(lines[0]).toContain(":1:match 1");
		expect(lines[1]).toContain(":3:match 2");
	});

	it("searches across multiple files", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/MEMORY.md`]: "found in long-term\n",
			[`${MOUNT}/daily/2025-06-01/note.md`]: "found in daily\n",
		});
		const result = await searchMemory("found", fs, { mountPoint: MOUNT });
		expect(result.stdout).toContain("MEMORY.md");
		expect(result.stdout).toContain("note.md");
	});

	it("output ends with newline when there are matches", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/MEMORY.md`]: "hello\n",
		});
		const result = await searchMemory("hello", fs, { mountPoint: MOUNT });
		expect(result.stdout.endsWith("\n")).toBe(true);
	});
});
