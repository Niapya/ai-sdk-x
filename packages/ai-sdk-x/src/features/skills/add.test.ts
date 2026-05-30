import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-skills add", () => {
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
});

function skillMarkdown(name: string, description: string): string {
	return ["---", `name: ${name}`, `description: ${description}`, "---", "", `# ${name}`, ""].join(
		"\n",
	);
}
