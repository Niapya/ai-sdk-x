import { describe, expect, it } from "bun:test";
import { createMemoryFeatureDescription } from "@/features/memory";
import X from "@/index";

describe("x-memory feature", () => {
	it("auto-initializes core files and the lockfile on exec", async () => {
		const x = X.init();

		expect(await x.fs.exists("/home/user/memory")).toBe(false);

		await x.exec("x-memory list");

		expect(await x.fs.exists("/home/user/memory/AGENT.md")).toBe(true);
		expect(await x.fs.exists("/home/user/memory/USER.md")).toBe(true);
		expect(await x.fs.exists("/home/user/memory/MEMORY.md")).toBe(true);
		expect(await x.fs.exists("/home/user/memory/memory.json")).toBe(true);
	});

	it("documents the memory layers and CLI-only mutation guidance", async () => {
		const x = X.init();

		const help = await x.exec("x-memory --help");
		const description = createMemoryFeatureDescription("/home/user/memory");

		expect(help.exitCode).toBe(0);
		expect(help.stdout).toContain("AGENT.md for agent-side notes");
		expect(help.stdout).toContain("USER.md for user-side notes");
		expect(help.stdout).toContain("MEMORY.md for shared context");
		expect(help.stdout).toContain("daily/YYYY-MM-DD/title.md");
		expect(help.stdout).toContain("memory.json stays in sync");
		expect(help.stdout).toContain("Commands:\n  add");
		expect(help.stdout).toContain("  find");
		expect(help.stdout).not.toContain("  init");
		expect(help.stdout).not.toContain("  search");

		expect(description).toContain("$MEMORY_HOME/AGENT.md");
		expect(description).toContain("$MEMORY_HOME/USER.md");
		expect(description).toContain("$MEMORY_HOME/MEMORY.md");
		expect(description).toContain("daily/YYYY-MM-DD/title.md");
		expect(description).toContain("x-memory list");
		expect(description).toContain("x-memory find");
		expect(description).toContain("x-memory add");
		expect(description).toContain("x-memory update");
		expect(description).toContain("x-memory delete");
		expect(description).toContain("DO NOT add, update, or delete memory entries DIRECTLY");
		expect(description).toContain("lockfile");
	});
});
