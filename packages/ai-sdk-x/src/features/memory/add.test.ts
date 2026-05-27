import { describe, expect, it } from "bun:test";
import { type CommandContext, EMPTY_BYTES, encodeUtf8ToBytes, InMemoryFs } from "just-bash";
import { addMemory } from "@/features/memory/add";
import { InMemoryKVStore } from "@/runtime/storage/in-memory-kv-store";

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

describe("addMemory – daily entry", () => {
	it("creates a daily entry file under daily/YYYY-MM-DD/", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("this is my note", fs);
		const result = await addMemory({ longTerm: false, title: "My Note" }, ctx, {
			mountPoint: MOUNT,
			now: () => new Date("2025-06-01T00:00:00Z"),
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("/home/user/memory/daily/2025-06-01/");
		const path = result.stdout.trim();
		const content = await fs.readFile(path);
		expect(content).toContain("this is my note");
		expect(content).toContain("# My Note");
	});

	it("slugifies the title for the filename", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("note body", fs);
		const result = await addMemory({ longTerm: false, title: "Hello World!" }, ctx, {
			mountPoint: MOUNT,
			now: () => new Date("2025-06-01T00:00:00Z"),
		});
		expect(result.stdout).toContain("hello-world");
	});

	it("uses 'memory' as filename when title is empty", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("note body", fs);
		const result = await addMemory({ longTerm: false, title: "" }, ctx, {
			mountPoint: MOUNT,
			now: () => new Date("2025-06-01T00:00:00Z"),
		});
		expect(result.stdout).toContain("/memory.md");
	});

	it("creates the mountPoint directory if it does not exist", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("content", fs);
		await addMemory({ longTerm: false, title: "auto-dir" }, ctx, {
			mountPoint: "/new/mount",
			now: () => new Date("2025-06-01T00:00:00Z"),
		});
		expect(await fs.exists("/new/mount")).toBe(true);
	});

	it("invalidates the list cache on success", async () => {
		const cache = new InMemoryKVStore();
		await cache.set("memory:list", "stale-value");
		const fs = new InMemoryFs();
		const ctx = makeCtx("content", fs);
		await addMemory({ longTerm: false, title: "cache" }, ctx, {
			mountPoint: MOUNT,
			cache,
			now: () => new Date("2025-06-01T00:00:00Z"),
		});
		expect(await cache.get("memory:list")).toBeNull();
	});
});

describe("addMemory – long-term entry", () => {
	it("creates MEMORY.md when it does not exist", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("first entry", fs);
		const result = await addMemory({ longTerm: true, title: "Long Term" }, ctx, {
			mountPoint: MOUNT,
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("MEMORY.md");
		const content = await fs.readFile(result.stdout.trim());
		expect(content).toContain("# Memory");
		expect(content).toContain("## Long Term");
		expect(content).toContain("first entry");
	});

	it("appends to MEMORY.md when it already exists", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/MEMORY.md`]: "# Memory\n\n## First\n\nexisting\n",
		});
		const ctx = makeCtx("new content", fs);
		const result = await addMemory({ longTerm: true, title: "Second" }, ctx, { mountPoint: MOUNT });

		expect(result.exitCode).toBe(0);
		const content = await fs.readFile(result.stdout.trim());
		expect(content).toContain("existing");
		expect(content).toContain("## Second");
		expect(content).toContain("new content");
	});

	it("uses 'Memory' as heading when title is empty", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("body", fs);
		await addMemory({ longTerm: true, title: "" }, ctx, { mountPoint: MOUNT });
		const content = await fs.readFile(`${MOUNT}/MEMORY.md`);
		expect(content).toContain("## Memory");
	});
});

describe("addMemory – error handling", () => {
	it("returns exitCode 1 when stdin is empty", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("", fs);
		const result = await addMemory({ longTerm: false, title: "test" }, ctx, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("stdin is empty");
	});

	it("returns exitCode 1 when stdin contains only whitespace", async () => {
		const fs = new InMemoryFs();
		const ctx = makeCtx("   \n  ", fs);
		const result = await addMemory({ longTerm: false, title: "test" }, ctx, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(1);
	});
});
