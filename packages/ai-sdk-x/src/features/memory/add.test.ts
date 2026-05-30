import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-memory add", () => {
	it("adds a daily memory entry and returns the new success message", async () => {
		const x = X.init({
			memory: {
				mountPoint: "/memory",
			},
		});

		const result = await x.exec(
			"x-memory add launch-note --description 'Launch summary' --keyword launch --stdin",
			{ stdin: "Launch body" },
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe(
			"Add memory launch-note to category daily at $MEMORY_HOME/daily/2026-05-30/launch-note.md Successfully!\n",
		);
		expect(await x.fs.readFile("/memory/daily/2026-05-30/launch-note.md")).toBe("Launch body");
		const index = JSON.parse(await x.fs.readFile("/memory/memory.json"));
		expect(index.categories.daily["launch-note"].description).toBe("Launch summary");
		expect(index.categories.daily["launch-note"].keywords).toEqual(["launch"]);
	});

	it("requires title, description, and keyword metadata", async () => {
		const x = X.init();

		const missingTitle = await x.exec("x-memory add --description 'A' --keyword one --stdin", {
			stdin: "body",
		});
		const missingDescription = await x.exec("x-memory add note --keyword one --stdin", {
			stdin: "body",
		});
		const missingKeyword = await x.exec("x-memory add note --description 'A' --stdin", {
			stdin: "body",
		});

		expect(missingTitle.exitCode).toBe(1);
		expect(missingTitle.stderr).toContain("missing <title>");
		expect(missingDescription.exitCode).toBe(1);
		expect(missingDescription.stderr).toContain("missing --description");
		expect(missingKeyword.exitCode).toBe(1);
		expect(missingKeyword.stderr).toContain("missing --keyword");
	});

	it("rejects non-daily categories", async () => {
		const x = X.init();

		const result = await x.exec(
			"x-memory add note --category project --description 'A' --keyword one --stdin",
			{ stdin: "body" },
		);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("only daily category is supported");
	});
});
