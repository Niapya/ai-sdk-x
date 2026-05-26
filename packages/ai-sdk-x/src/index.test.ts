import { describe, expect, it } from "bun:test";
import X from "@/index";
import type { Feature } from "@/types";

describe("X feature runtime", () => {
	it("starts with no default features in constructor", async () => {
		const x = new X();

		expect(x.commands.length).toBe(0);
		expect(await x.fs.exists("/home/user/memory")).toBe(false);
		expect(await x.fs.exists("/home/user/skills")).toBe(false);
		expect(await x.fs.exists("/home/user/workspace")).toBe(false);

		const result = await x.exec(
			'printf "%s|%s|%s" "$WORKSPACE_HOME" "$SKILLS_HOME" "$MEMORY_HOME"',
		);
		expect(result.stdout).toBe("||");
	});

	it("registerFeature registers commands immediately and initializes once on exec", async () => {
		const x = new X();
		let initCount = 0;

		x.registerFeature({
			name: "demo",
			command: [
				{
					name: "x-demo",
					async execute() {
						return {
							stdout: "demo",
							stderr: "",
							exitCode: 0,
						};
					},
				},
			],
			init: async ({ fs }) => {
				initCount += 1;
				await fs.mkdir("/tmp/demo", { recursive: true });
			},
		});

		expect(x.commands.some((command) => command.name === "x-demo")).toBe(true);
		expect(await x.fs.exists("/tmp/demo")).toBe(false);

		const first = await x.exec("x-demo");
		expect(first.stdout).toBe("demo");
		expect(initCount).toBe(1);
		expect(await x.fs.exists("/tmp/demo")).toBe(true);

		const second = await x.exec("x-demo");
		expect(second.stdout).toBe("demo");
		expect(initCount).toBe(1);
	});

	it("overwrites same feature command and env directly", async () => {
		const x = new X();

		x.registerFeature(createEchoFeature("override", "x-overwrite", "/one"));
		x.registerFeature(createEchoFeature("override", "x-overwrite", "/two"));

		const commandResult = await x.exec("x-overwrite");
		expect(commandResult.stdout).toBe("/two");

		const envResult = await x.exec('printf "%s" "$DEMO_HOME"');
		expect(envResult.stdout).toBe("/two");
		expect(x.commands.filter((command) => command.name === "x-overwrite").length).toBe(1);
	});

	it("X.init registers built-in features and exports mount env", async () => {
		const x = X.init();

		expect(x.commands.some((command) => command.name === "git")).toBe(true);
		expect(x.commands.some((command) => command.name === "x-memory")).toBe(true);
		expect(x.commands.some((command) => command.name === "x-patch")).toBe(true);
		expect(x.commands.some((command) => command.name === "x-skills")).toBe(true);
		expect(await x.fs.exists("/home/user/memory")).toBe(false);

		const envResult = await x.exec(
			'printf "%s|%s|%s" "$WORKSPACE_HOME" "$SKILLS_HOME" "$MEMORY_HOME"',
		);
		expect(envResult.stdout).toBe("/home/user/workspace|/home/user/skills|/home/user/memory");
		expect(await x.fs.exists("/home/user/memory")).toBe(true);
		expect(await x.fs.exists("/home/user/skills")).toBe(true);
		expect(await x.fs.exists("/home/user/workspace")).toBe(true);
	});

	it("X.init supports disabling built-in features", async () => {
		const x = X.init({
			git: false,
			memory: false,
			patch: false,
			skills: false,
			workspace: false,
		});

		expect(x.commands.length).toBe(0);

		const envResult = await x.exec(
			'printf "%s|%s|%s" "$WORKSPACE_HOME" "$SKILLS_HOME" "$MEMORY_HOME"',
		);
		expect(envResult.stdout).toBe("||");

		const skillsResult = await x.exec("x-skills list");
		expect(skillsResult.stderr.includes("command not found")).toBe(true);
	});

	it("lazily creates skills.json during install and updates skills from git", async () => {
		const x = X.init();

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
		const x = X.init({
			skills: {
				lockfile: false,
			},
		});

		await initializeSkillRepo(x, "/origin", "demo", skillMarkdown("Demo", "Version 1"));

		const installResult = await x.exec("x-skills install /origin@demo");
		expect(installResult.exitCode).toBe(0);
		expect(await x.fs.exists("/home/user/skills/skills.json")).toBe(false);
	});

	it("surfaces git command failures when git feature is disabled", async () => {
		const x = X.init({
			git: false,
		});

		const installResult = await x.exec("x-skills install /origin@demo");
		expect(installResult.exitCode).not.toBe(0);
		expect(installResult.stderr.includes("command not found")).toBe(true);
	});
});

function createEchoFeature(name: string, commandName: string, output: string): Feature {
	return {
		name,
		command: [
			{
				name: commandName,
				async execute() {
					return {
						stdout: output,
						stderr: "",
						exitCode: 0,
					};
				},
			},
		],
		env: {
			DEMO_HOME: output,
		},
	};
}

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
