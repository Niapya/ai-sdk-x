import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("X feature setup", () => {
	it("registers built-in feature commands by default", () => {
		const x = new X();

		expect("git" in x.commands).toBe(true);
		expect("memory" in x.commands).toBe(true);
		expect("patch" in x.commands).toBe(true);
		expect("skills" in x.commands).toBe(true);
	});

	it("exports enabled feature mounts as shell environment variables", async () => {
		const x = new X({
			memory: { mountPoint: "/mem" },
			skills: { mountPoint: "/skills-dir" },
			workspace: { mountPoint: "/workspace-dir" },
		});

		const result = await x.exec(
			'printf "%s|%s|%s" "$WORKSPACE_HOME" "$SKILLS_HOME" "$MEMORY_HOME"',
		);

		expect(result.stdout).toBe("/workspace-dir|/skills-dir|/mem");
	});

	it("omits feature home environment variables when features are disabled", async () => {
		const x = new X({
			memory: false,
			skills: false,
			workspace: false,
		});

		const result = await x.exec(
			'printf "%s|%s|%s" "$WORKSPACE_HOME" "$SKILLS_HOME" "$MEMORY_HOME"',
		);

		expect(result.stdout).toBe("||");
	});

	it("skips disabled feature commands and mounts", async () => {
		const x = new X({
			git: false,
			memory: false,
			patch: false,
			skills: false,
			workspace: false,
		});

		expect("git" in x.commands).toBe(false);
		expect("memory" in x.commands).toBe(false);
		expect("patch" in x.commands).toBe(false);
		expect("skills" in x.commands).toBe(false);
		expect(await x.fs.exists("/home/user/memory")).toBe(false);
		expect(await x.fs.exists("/home/user/skills")).toBe(false);
		expect(await x.fs.exists("/home/user/workspace")).toBe(false);

		const gitResult = await x.exec("git status");
		const memoryResult = await x.exec("x-memory list");
		const skillsResult = await x.exec("x-skills list");
		const patchResult = await x.exec("x-patch --help");

		expect(gitResult.stderr.includes("command not found")).toBe(true);
		expect(memoryResult.stderr.includes("command not found")).toBe(true);
		expect(skillsResult.stderr.includes("command not found")).toBe(true);
		expect(patchResult.stderr.includes("command not found")).toBe(true);
	});

	it("lazily creates skills.json during install and updates skills from git", async () => {
		const x = new X();

		await initializeSkillRepo(x, "/origin", "demo", skillMarkdown("Demo", "Version 1"));
		expect(await x.fs.exists("/home/user/skills/skills.json")).toBe(false);

		const installResult = await x.exec("x-skills install /origin@demo");
		expect(installResult.exitCode).toBe(0);
		expect(await x.fs.readFile("/home/user/skills/demo/SKILL.md")).toContain("Version 1");

		const lockfile = JSON.parse(await x.fs.readFile("/home/user/skills/skills.json"));
		expect(lockfile.skills.demo.source.repo).toBe("/origin");

		await writeSkillToRepo(x, "/origin", "demo", skillMarkdown("Demo", "Version 2"));
		await commitRepo(x, "/origin", "update-demo");

		const updateResult = await x.exec("x-skills update");
		expect(updateResult.exitCode).toBe(0);
		expect(updateResult.stdout).toContain("Updated 1 skill");
		expect(await x.fs.readFile("/home/user/skills/demo/SKILL.md")).toContain("Version 2");
	});

	it("does not write skills.json when lockfile support is disabled", async () => {
		const x = new X({
			skills: {
				lockfile: false,
			},
		});

		await initializeSkillRepo(x, "/origin", "demo", skillMarkdown("Demo", "Version 1"));

		const installResult = await x.exec("x-skills install /origin@demo");
		expect(installResult.exitCode).toBe(0);
		expect(await x.fs.exists("/home/user/skills/skills.json")).toBe(false);
	});

	it("surfaces git command failures when the git feature is disabled", async () => {
		const x = new X({
			git: false,
		});

		const installResult = await x.exec("x-skills install /origin@demo");
		expect(installResult.exitCode).not.toBe(0);
		expect(installResult.stderr.includes("command not found")).toBe(true);
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

	await commitRepo(x, repoPath, "init-demo");
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

function skillMarkdown(title: string, body: string): string {
	return `---\nname: ${title}\ndescription: ${body}\n---\n\n# ${title}\n\n${body}\n`;
}
