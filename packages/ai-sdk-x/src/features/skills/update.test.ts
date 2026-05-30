import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-skills update", () => {
	it("updates all git skills by default", async () => {
		const x = X.init();
		await initializeSkillRepo(x, "/origin", "demo", skillMarkdown("Demo", "Version 1"));
		await x.exec("x-skills install /origin@demo");
		await writeSkillToRepo(x, "/origin", "demo", skillMarkdown("Demo", "Version 2"));
		await commitRepo(x, "/origin", "update-demo");

		const result = await x.exec("x-skills update");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Update `demo` successfully.");
		expect(result.stdout).toContain("Total updated skills: 1");
		expect(await x.fs.readFile("/home/user/skills/demo/SKILL.md")).toContain("Version 2");
	});

	it("updates only the requested skill name", async () => {
		const x = X.init();
		await initializeSkillRepo(x, "/origin", "one", skillMarkdown("One", "One v1"));
		await writeSkillToRepo(x, "/origin", "two", skillMarkdown("Two", "Two v1"));
		await commitRepo(x, "/origin", "add-two");
		await x.exec("x-skills install /origin@one");
		await x.exec("x-skills install /origin@two");
		await writeSkillToRepo(x, "/origin", "one", skillMarkdown("One", "One v2"));
		await writeSkillToRepo(x, "/origin", "two", skillMarkdown("Two", "Two v2"));
		await commitRepo(x, "/origin", "update-both");

		const result = await x.exec("x-skills update one");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Update `one` successfully.");
		expect(result.stdout).toContain("Total updated skills: 1");
		expect(result.stdout).not.toContain("Update `two` successfully.");
		expect(await x.fs.readFile("/home/user/skills/one/SKILL.md")).toContain("One v2");
		expect(await x.fs.readFile("/home/user/skills/two/SKILL.md")).toContain("Two v1");
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

	await commitRepo(x, repoPath, "init-skill");
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

async function commitRepo(x: X, repoPath: string, message: string): Promise<void> {
	const commitResult = await x.exec(`git add . && git commit -m "${message}"`, {
		cwd: repoPath,
	});
	expect(commitResult.exitCode).toBe(0);
}

function skillMarkdown(name: string, description: string): string {
	return ["---", `name: ${name}`, `description: ${description}`, "---", "", description].join("\n");
}
