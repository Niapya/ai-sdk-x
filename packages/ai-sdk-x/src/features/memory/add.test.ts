import { describe, expect, it } from "bun:test";
import { type CommandContext, EMPTY_BYTES, encodeUtf8ToBytes, InMemoryFs } from "just-bash";
import { addMemory } from "@/features/memory/add";

const HOME = "/home/user";
const MOUNT = "/home/user/memory";

function makeCtx(stdin: string, fs: InMemoryFs): CommandContext {
	return {
		cwd: HOME,
		env: new Map([["HOME", HOME]]),
		fs,
		stdin: stdin ? encodeUtf8ToBytes(stdin) : EMPTY_BYTES,
	};
}

describe("addMemory", () => {
	it("creates memory.json with a daily entry", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("this is my note", fs);
		const result = await addMemory({ keywords: ["project", "note"], title: "My Note" }, ctx, {
			mountPoint: MOUNT,
			now: () => new Date("2025-06-01T00:00:00Z"),
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("2025-06-01:My Note\n");

		const index = JSON.parse(await fs.readFile(`${MOUNT}/memory.json`));
		expect(index.daily["2025-06-01"]["My Note"].description).toBe("this is my note");
		expect(index.daily["2025-06-01"]["My Note"].keywords).toEqual(["project", "note"]);
		expect(typeof index.daily["2025-06-01"]["My Note"].createAt).toBe("number");
	});

	it("uses Memory as title when title is empty", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("note body", fs);
		const result = await addMemory({ title: "" }, ctx, {
			mountPoint: MOUNT,
			now: () => new Date("2025-06-01T00:00:00Z"),
		});

		expect(result.stdout).toBe("2025-06-01:Memory\n");
		const index = JSON.parse(await fs.readFile(`${MOUNT}/memory.json`));
		expect(index.daily["2025-06-01"].Memory.description).toBe("note body");
	});

	it("creates the mountPoint directory if it does not exist", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("content", fs);
		await addMemory({ title: "auto-dir" }, ctx, {
			mountPoint: "/new/mount",
			now: () => new Date("2025-06-01T00:00:00Z"),
		});
		expect(await fs.exists("/new/mount/memory.json")).toBe(true);
	});
});

describe("addMemory – error handling", () => {
	it("returns exitCode 1 when stdin is empty", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("", fs);
		const result = await addMemory({ title: "test" }, ctx, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("stdin is empty");
	});

	it("returns exitCode 1 when stdin contains only whitespace", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("   \n  ", fs);
		const result = await addMemory({ title: "test" }, ctx, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(1);
	});
});
