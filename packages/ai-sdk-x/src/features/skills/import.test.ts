import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-skills import", () => {
	it("imports a skill directory and returns readable metadata", async () => {
		const x = X.init();
		await writeLocalSkill(x, "/tmp/local-skill", {
			description: "Local description",
			name: "Local Skill",
		});
		await x.fs.writeFile("/tmp/local-skill/notes.md", "extra");

		const result = await x.exec("x-skills import /tmp/local-skill imported-skill");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Skills imported successfully.");
		expect(result.stdout).toContain("Skills Name: imported-skill");
		expect(result.stdout).toContain("Description: Local description");
		expect(result.stdout).toContain("Skill File: $SKILLS_HOME/imported-skill/SKILL.md");
		expect(result.stdout).toContain("- $SKILLS_HOME/imported-skill/SKILL.md");
		expect(result.stdout).toContain("- $SKILLS_HOME/imported-skill/notes.md");
	});

	it("requires name and description metadata", async () => {
		const x = X.init();
		await x.fs.mkdir("/tmp/invalid-skill", { recursive: true });
		await x.fs.writeFile("/tmp/invalid-skill/SKILL.md", "---\ndescription: Missing name\n---\n");

		const result = await x.exec("x-skills import /tmp/invalid-skill");

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("name and description");
	});

	it("shows the expected skill folder structure in help", async () => {
		const x = X.init();

		const result = await x.exec("x-skills import --help");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("The folder must contain SKILL.md or SKILLS.md");
		expect(result.stdout).toContain("Required frontmatter fields: name, description.");
		expect(result.stdout).toContain("Expected folder structure:");
		expect(result.stdout).toContain("skill-name/");
		expect(result.stdout).toContain("scripts/      optional executable helpers");
		expect(result.stdout).toContain("references/   optional docs loaded only when needed");
		expect(result.stdout).toContain("assets/       optional templates");
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
