import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-memory delete", () => {
	it("deletes a daily memory entry and its body file", async () => {
		const x = X.init();
		await x.exec("x-memory add old-note --description 'Old summary' --keyword old --stdin", {
			stdin: "Old body",
		});

		const result = await x.exec("x-memory delete old-note");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("Delete memory old-note from category daily Successfully!\n");
		expect(await x.fs.exists("/home/user/memory/daily/2026-05-30/old-note.md")).toBe(false);
		const index = JSON.parse(await x.fs.readFile("/home/user/memory/memory.json"));
		expect(index.categories.daily).toBeUndefined();
	});

	it("does not delete core memory files", async () => {
		const x = X.init();

		const result = await x.exec("x-memory delete AGENT.md");

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("cannot delete core memory file");
		expect(await x.fs.exists("/home/user/memory/AGENT.md")).toBe(true);
	});

	it("rejects non-daily categories", async () => {
		const x = X.init();

		const result = await x.exec("x-memory delete note --category project");

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("only daily category is supported");
	});
});
