import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-skills add", () => {
	it("points users to add and import help from the root help", async () => {
		const x = X.init();

		const result = await x.exec("x-skills --help");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Run `x-skills add --help`");
		expect(result.stdout).toContain("Run `x-skills import --help`");
	});

	it("adds a skill markdown file and returns readable metadata", async () => {
		const x = X.init();
		await x.fs.writeFile("/tmp/SKILL.md", skillMarkdown("Demo", "Demo description"));

		const result = await x.exec("x-skills add --file /tmp/SKILL.md");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Skills added successfully.");
		expect(result.stdout).toContain("Skills Name: Demo");
		expect(result.stdout).toContain("Description: Demo description");
		expect(result.stdout).toContain("Skill File: $SKILLS_HOME/Demo/SKILL.md");
		expect(result.stdout).toContain("Source: local");
		expect(result.stdout).toContain("- $SKILLS_HOME/Demo/SKILL.md");
	});

	it("requires name and description metadata", async () => {
		const x = X.init();

		const result = await x.exec("x-skills add --stdin", {
			stdin: "---\nname: Missing Description\n---\n",
		});

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("name and description");
	});

	it("shows the expected SKILL.md structure in help", async () => {
		const x = X.init();

		const result = await x.exec("x-skills add --help");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("The skill file must be a SKILL.md markdown document");
		expect(result.stdout).toContain("Required frontmatter fields: name, description.");
		expect(result.stdout).toContain("Minimal SKILL.md structure:");
		expect(result.stdout).toContain("name: my-skill");
		expect(result.stdout).toContain(
			"description: Describe what the skill does and when Codex should use it.",
		);
		expect(result.stdout).toContain("For skills with bundled resources");
		expect(result.stdout).not.toContain("scripts/, references/, or assets/");
	});
});

function skillMarkdown(name: string, description: string): string {
	return ["---", `name: ${name}`, `description: ${description}`, "---", "", `# ${name}`, ""].join(
		"\n",
	);
}
