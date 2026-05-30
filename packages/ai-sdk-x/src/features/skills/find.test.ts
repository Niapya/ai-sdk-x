import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-skills find", () => {
	it("finds skills by directory title, description, and frontmatter with ASCII highlights", async () => {
		const x = X.init();
		await writeLocalSkill(x, "/tmp/design-source", {
			body: "The body mentions invisible-token but should not be searched.",
			description: "Useful design workflows",
			name: "Frontmatter Title",
		});
		await x.fs.writeFile(
			"/tmp/design-source/SKILL.md",
			[
				"---",
				"name: Frontmatter Title",
				"description: Useful design workflows",
				"category: visual-design",
				"---",
				"",
				"invisible-token only appears in body",
			].join("\n"),
		);
		await writeLocalSkill(x, "/tmp/code-source", {
			description: "Coding workflows",
			name: "Code Title",
		});
		await x.exec("x-skills import /tmp/design-source design-dir");
		await x.exec("x-skills import /tmp/code-source code-dir");

		const result = await x.exec("x-skills find design --page 1 --limit 10");
		const bodyOnlyResult = await x.exec("x-skills find invisible-token");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Find results for `design`(page 1/1, limit 10, total 1)");
		expect(result.stdout).toContain("Title: [[design]]-dir");
		expect(result.stdout).toContain("Description: Useful [[design]] workflows");
		expect(result.stdout).toContain("category: visual-[[design]]");
		expect(result.stdout).toContain("File Path: $SKILLS_HOME/design-dir/SKILL.md");
		expect(result.stdout).not.toContain("code-dir");

		expect(bodyOnlyResult.stdout).toContain("total 0");
	});

	it("paginates find results", async () => {
		const x = X.init();
		await writeLocalSkill(x, "/tmp/one-source", {
			description: "shared keyword",
			name: "One",
		});
		await writeLocalSkill(x, "/tmp/two-source", {
			description: "shared keyword",
			name: "Two",
		});
		await x.exec("x-skills import /tmp/one-source one");
		await x.exec("x-skills import /tmp/two-source two");

		const result = await x.exec("x-skills find keyword --page 2 --limit 1");

		expect(result.stdout).toContain("Find results for `keyword`(page 2/2, limit 1, total 2)");
		expect(result.stdout).toContain("Title: two");
		expect(result.stdout).not.toContain("Title: one");
	});
});

async function writeLocalSkill(
	x: X,
	path: string,
	input: { body?: string; description: string; name: string },
): Promise<void> {
	await x.fs.mkdir(path, { recursive: true });
	await x.fs.writeFile(
		`${path}/SKILL.md`,
		[
			"---",
			`name: ${input.name}`,
			`description: ${input.description}`,
			"---",
			"",
			input.body ?? input.description,
		].join("\n"),
	);
}
