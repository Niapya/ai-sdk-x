import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-skills list", () => {
	it("lists skills with pagination and directory titles", async () => {
		const x = X.init();
		await writeLocalSkill(x, "/tmp/alpha-source", {
			description: "Alpha description",
			name: "Frontmatter Name",
		});
		await writeLocalSkill(x, "/tmp/beta-source", {
			description: "Beta description",
			name: "Beta Frontmatter",
		});
		await x.exec("x-skills import /tmp/alpha-source alpha-dir");
		await x.exec("x-skills import /tmp/beta-source beta-dir");

		const firstPage = await x.exec("x-skills list --page 1 --limit 1");
		const secondPage = await x.exec("x-skills list --page 2 --limit 1");

		expect(firstPage.exitCode).toBe(0);
		expect(firstPage.stdout).toContain("All available skills in the mount point will be listed.");
		expect(firstPage.stdout).toContain("View specific skills via the skill file path.");
		expect(firstPage.stdout).toContain("Page 1/2, limit 1, total 2.");
		expect(firstPage.stdout).toContain("Title: alpha-dir");
		expect(firstPage.stdout).not.toContain("Title: Frontmatter Name");
		expect(firstPage.stdout).not.toContain("Title: beta-dir");

		expect(secondPage.stdout).toContain("Page 2/2, limit 1, total 2.");
		expect(secondPage.stdout).toContain("Title: beta-dir");
	});

	it("rejects invalid pagination", async () => {
		const x = X.init();
		const result = await x.exec("x-skills list --page 0");

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("--page must be a positive integer");
	});

	it("includes installed skills in the bash tool description with short descriptions", async () => {
		const x = X.init();
		const longDescription = "Long description ".repeat(30);
		await writeLocalSkill(x, "/tmp/long-source", {
			description: longDescription,
			name: "Long Skill",
		});
		await x.exec("x-skills import /tmp/long-source long-skill");

		const description = await x.createToolDescription();

		expect(description).toContain("<available_skills>");
		expect(description).toContain("<skill>");
		expect(description).toContain("<title>long-skill</title>");
		expect(description).toContain("$SKILLS_HOME/long-skill/SKILL.md");
		expect(description).toContain("Long description Long description");
		expect(description).toContain("...");
		expect(description).not.toContain(longDescription);
	});

	it("allows extra fields in skills lockfile entries", async () => {
		const x = X.init();
		await x.fs.mkdir("/home/user/skills/alpha", { recursive: true });
		await x.fs.writeFile(
			"/home/user/skills/alpha/SKILL.md",
			["---", "name: Alpha", "description: Alpha description", "---", ""].join("\n"),
		);
		await x.fs.writeFile(
			"/home/user/skills/skills.json",
			JSON.stringify(
				{
					extraRootField: "kept-compatible",
					skills: {
						alpha: {
							createAt: 1,
							description: "Alpha description",
							extraEntryField: true,
							files: ["$SKILLS_HOME/alpha/SKILL.md"],
							skillPath: "$SKILLS_HOME/alpha/SKILL.md",
							updateAt: 2,
						},
					},
					version: 1,
				},
				null,
				2,
			),
		);

		const result = await x.exec("x-skills list");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Title: alpha");
		expect(result.stdout).toContain("Description: Alpha description");
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
