import { describe, expect, it } from "bun:test";
import { InMemoryFs } from "just-bash";
import { listMemory } from "@/features/memory/list";

const MOUNT = "/home/user/memory";

describe("listMemory", () => {
	it("returns empty stdout when mount does not exist", async () => {
		const fs = new InMemoryFs();
		const result = await listMemory(fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});

	it("lists MEMORY.md and daily entries sorted", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/MEMORY.md`]: "# Memory",
			[`${MOUNT}/daily/2025-06-01/note.md`]: "# Note 1",
			[`${MOUNT}/daily/2025-06-02/note.md`]: "# Note 2",
		});
		const result = await listMemory(fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("MEMORY.md");
		expect(result.stdout).toContain("2025-06-01");
		expect(result.stdout).toContain("2025-06-02");
		// Output should end with newline
		expect(result.stdout.endsWith("\n")).toBe(true);
	});

	it("excludes non-.md files from daily directories", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/daily/2025-06-01/note.md`]: "# Note",
			[`${MOUNT}/daily/2025-06-01/data.json`]: "{}",
		});
		const result = await listMemory(fs, { mountPoint: MOUNT });
		expect(result.stdout).not.toContain("data.json");
		expect(result.stdout).toContain("note.md");
	});

	it("returns empty stdout when mount exists but is empty", async () => {
		const fs = new InMemoryFs();
		await fs.mkdir(MOUNT, { recursive: true });
		const result = await listMemory(fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});

	it("skips non-directory entries inside daily/", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/daily/stray-file.md`]: "not a dated folder",
			[`${MOUNT}/daily/2025-06-01/real.md`]: "real note",
		});
		const result = await listMemory(fs, { mountPoint: MOUNT });
		// stray-file.md lives directly under daily/ – it's not a directory, so it's skipped
		expect(result.stdout).not.toContain("stray-file.md");
		expect(result.stdout).toContain("real.md");
	});
});
