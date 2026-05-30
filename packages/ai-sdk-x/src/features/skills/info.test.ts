import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-skills info", () => {
	it("shows full metadata and frontmatter for a skill", async () => {
		const x = X.init();
		await writeLocalSkill(x, "/tmp/info-source", {
			description: "Info description",
			name: "Info Frontmatter",
		});
		await x.fs.writeFile(
			"/tmp/info-source/SKILL.md",
			[
				"---",
				"name: Info Frontmatter",
				"description: Info description",
				"category: diagnostics",
				"---",
				"",
				"body",
			].join("\n"),
		);
		await x.exec("x-skills import /tmp/info-source info-dir");

		const result = await x.exec("x-skills info info-dir");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Title: info-dir");
		expect(result.stdout).toContain("Description: Info description");
		expect(result.stdout).toContain("File Path: $SKILLS_HOME/info-dir/SKILL.md");
		expect(result.stdout).toContain("Files:\n- $SKILLS_HOME/info-dir/SKILL.md");
		expect(result.stdout).toContain("Front Matter:");
		expect(result.stdout).toContain("category: diagnostics");
		expect(result.stdout).toContain("name: Info Frontmatter");
	});
});

async function writeLocalSkill(
	x: X,
	path: string,
	input: { description: string; name: string },
): Promise<void> {
	await x.fs.mkdir(path, { recursive: true });
	await x.fs.writeFile(
		`${path}/SKILL.md`,
		["---", `name: ${input.name}`, `description: ${input.description}`, "---", ""].join("\n"),
	);
}
