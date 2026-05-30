import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-memory find", () => {
	it("finds daily memories by metadata only with ASCII highlights", async () => {
		const x = X.init();
		await x.exec(
			"x-memory add design-note --description 'Useful design summary' --keyword visual --stdin",
			{
				stdin: "Body mentions invisible-token but should not be searched.",
			},
		);
		await x.exec(
			"x-memory add code-note --description 'Useful code summary' --keyword backend --stdin",
			{
				stdin: "Code body",
			},
		);
		await x.exec("x-memory update AGENT.md --stdin", {
			stdin: "Core file mentions design but should not be searched.",
		});

		const result = await x.exec("x-memory find design --page 1 --limit 10");
		const bodyOnlyResult = await x.exec("x-memory find invisible-token");
		const coreOnlyResult = await x.exec("x-memory find Core");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain(
			"Find memory metadata for `design`(page 1/1, limit 10, total 1)",
		);
		expect(result.stdout).toContain(
			"Only metadata is searched: name, category, description, and keywords.",
		);
		expect(result.stdout).toContain("Name: [[design]]-note");
		expect(result.stdout).toContain("Description: Useful [[design]] summary");
		expect(result.stdout).toContain("File Path: $MEMORY_HOME/daily/2026-05-30/design-note.md");
		expect(result.stdout).not.toContain("code-note");

		expect(bodyOnlyResult.stdout).toContain("total 0");
		expect(coreOnlyResult.stdout).toContain("total 0");
	});

	it("paginates find results", async () => {
		const x = X.init();
		await x.exec("x-memory add one --description 'Shared keyword' --keyword shared --stdin", {
			stdin: "One body",
		});
		await x.exec("x-memory add two --description 'Shared keyword' --keyword shared --stdin", {
			stdin: "Two body",
		});

		const result = await x.exec("x-memory find shared --page 2 --limit 1");

		expect(result.stdout).toContain(
			"Find memory metadata for `shared`(page 2/2, limit 1, total 2)",
		);
		expect(result.stdout).toContain("Name: two");
		expect(result.stdout).not.toContain("Name: one");
	});

	it("rejects invalid pagination and non-daily categories", async () => {
		const x = X.init();

		const invalidPage = await x.exec("x-memory find note --page 0");
		const invalidCategory = await x.exec("x-memory find note --category project");

		expect(invalidPage.exitCode).toBe(1);
		expect(invalidPage.stderr).toContain("--page must be a positive integer");
		expect(invalidCategory.exitCode).toBe(1);
		expect(invalidCategory.stderr).toContain("only daily category is supported");
	});
});
