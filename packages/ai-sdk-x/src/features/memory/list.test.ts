import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-memory list", () => {
	it("lists core files and daily entries as a tree", async () => {
		const x = X.init();
		await x.exec("x-memory add alpha --description 'Alpha summary' --keyword alpha --stdin", {
			stdin: "Alpha body",
		});

		const result = await x.exec("x-memory list");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Memory files in /home/user/memory:");
		expect(result.stdout).toContain("Core:");
		expect(result.stdout).toContain("- /home/user/memory/AGENT.md");
		expect(result.stdout).toContain("- /home/user/memory/USER.md");
		expect(result.stdout).toContain("- /home/user/memory/MEMORY.md");
		expect(result.stdout).toContain("daily/");
		expect(result.stdout).toContain("- alpha");
		expect(result.stdout).toContain("Description: Alpha summary");
		expect(result.stdout).toContain("Keywords: alpha");
		expect(result.stdout).toContain("File Path: $MEMORY_HOME/daily/2026-05-30/alpha.md");
	});

	it("rejects non-daily categories", async () => {
		const x = X.init();

		const result = await x.exec("x-memory list --category project");

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("only daily category is supported");
	});
});
