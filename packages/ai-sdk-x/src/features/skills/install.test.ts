import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-skills install", () => {
	it("installs a skill with shallow git clone and returns readable metadata", async () => {
		const x = X.init();
		await initializeSkillRepo(
			x,
			"/origin",
			"demo",
			skillMarkdown("Demo Frontmatter", "Demo description"),
		);

		const result = await x.exec("x-skills install /origin@demo");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Skill installed successfully.");
		expect(result.stdout).toContain("Skills Name: demo");
		expect(result.stdout).toContain("Description: Demo description");
		expect(result.stdout).toContain("Skill File: $SKILLS_HOME/demo/SKILL.md");
		expect(result.stdout).toContain("Source: /origin");
		expect(result.stdout).toContain("- $SKILLS_HOME/demo/SKILL.md");
	});

	it("uses depth=1 when cloning repositories", async () => {
		const commands: string[] = [];
		const x = X.init({
			git: false,
			workspace: false,
		});
		x.registerCommand({
			name: "git",
			async execute(argv) {
				commands.push(["git", ...argv].join(" "));
				return {
					exitCode: 1,
					stderr: "stop before copy\n",
					stdout: "",
				};
			},
		});

		await x.exec("x-skills install /origin@demo");

		expect(commands[0]).toContain("git clone --depth=1 /origin /tmp/skills/origin");
	});

	it("adds an explicit install error when git clone fails without output", async () => {
		const x = X.init({
			git: false,
			workspace: false,
		});
		x.registerCommand({
			name: "git",
			async execute() {
				return {
					exitCode: 1,
					stderr: "",
					stdout: "",
				};
			},
		});

		const result = await x.exec("x-skills install /origin@demo");

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("x-skills install: failed to clone /origin");
		expect(result.stderr).toContain("git clone failed without output");
	});
});

async function initializeSkillRepo(
	x: X,
	repoPath: string,
	selector: string,
	markdown: string,
): Promise<void> {
	await x.fs.mkdir(repoPath, { recursive: true });
	await writeSkillToRepo(x, repoPath, selector, markdown);

	const initResult = await x.exec(
		'git init && git config user.name "Test User" && git config user.email "test@example.com"',
		{ cwd: repoPath },
	);
	expect(initResult.exitCode).toBe(0);

	const commitResult = await x.exec('git add . && git commit -m "init-skill"', {
		cwd: repoPath,
	});
	expect(commitResult.exitCode).toBe(0);
}

async function writeSkillToRepo(
	x: X,
	repoPath: string,
	selector: string,
	markdown: string,
): Promise<void> {
	const skillPath = `${repoPath}/skills/${selector}`;
	await x.fs.mkdir(skillPath, { recursive: true });
	await x.fs.writeFile(`${skillPath}/SKILL.md`, markdown);
}

function skillMarkdown(name: string, description: string): string {
	return ["---", `name: ${name}`, `description: ${description}`, "---", "", description].join("\n");
}
