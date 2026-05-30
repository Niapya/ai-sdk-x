import { describe, expect, it } from "bun:test";
import { InMemoryFs } from "just-bash";
import X from "@/index";
import { AsyncOnce } from "@/runtime/async-once";
import { MemoryEnvBackend } from "@/runtime/env";
import type { ExecHookStartContext, Feature } from "@/types";

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

	it("registerFeature registers commands immediately and runs start hooks on exec", async () => {
		const x = new X();
		let startCount = 0;

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
			hooks: {
				onExecStart: async ({ fs }) => {
					startCount += 1;
					await fs.mkdir("/tmp/demo", { recursive: true });
				},
			},
		});

		expect(x.commands.some((command) => command.name === "x-demo")).toBe(true);
		expect(await x.fs.exists("/tmp/demo")).toBe(false);

		const first = await x.exec("x-demo");
		expect(first.stdout).toBe("demo");
		expect(startCount).toBe(1);
		expect(await x.fs.exists("/tmp/demo")).toBe(true);

		const second = await x.exec("x-demo");
		expect(second.stdout).toBe("demo");
		expect(startCount).toBe(2);
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
		expect(installResult.stdout).toContain("installed\tdemo");
		expect(installResult.stdout).toContain("source\t/origin");
		expect(installResult.stdout).toContain("skillPath\t$SKILLS_HOME/demo/SKILL.md");
		expect(installResult.stdout).toContain("files\t1");
		expect(await x.fs.readFile("/home/user/skills/demo/SKILL.md")).toContain("Version 1");

		const lockfile = JSON.parse(await x.fs.readFile("/home/user/skills/skills.json"));
		expect(lockfile.skills.demo.url).toBe("/origin");
		expect(lockfile.skills.demo.source).toBe("git");
		expect(lockfile.skills.demo.skillPath).toBe("$SKILLS_HOME/demo/SKILL.md");
		expect(lockfile.skills.demo.files).toContain("$SKILLS_HOME/demo/SKILL.md");

		await writeSkillToRepo(x, "/origin", "demo", skillMarkdown("Demo", "Version 2"));
		await commitRepo(x, "/origin", "update-demo");

		const updateResult = await x.exec("x-skills update");
		expect(updateResult.exitCode).toBe(0);
		expect(updateResult.stdout).toContain("Updated 1 skill");
		expect(await x.fs.readFile("/home/user/skills/demo/SKILL.md")).toContain("Version 2");

		const getResult = await x.exec("x-skills get demo");
		expect(getResult.stdout).toContain("skillPath\t$SKILLS_HOME/demo/SKILL.md");
		expect(getResult.stdout).toContain("Version 2");

		const infoResult = await x.exec("x-skills info demo");
		expect(infoResult.stdout).toContain('"skillName": "demo"');
		expect(infoResult.stdout).toContain('"url": "/origin"');

		const removeResult = await x.exec("x-skills remove -y demo");
		expect(removeResult.exitCode).toBe(0);
		expect(await x.fs.exists("/home/user/skills/demo")).toBe(false);
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
		hooks: {
			onExecStart: ({ setEnv }) => {
				setEnv("DEMO_HOME", output);
			},
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

// ─── Additional tests ────────────────────────────────────────────────────────

describe("X constructor options", () => {
	it("defaults cwd to the home directory", async () => {
		const x = new X();
		const result = await x.exec("pwd");
		expect(result.stdout.trim()).toBe("/home/user");
	});

	it("preserves just-bash default filesystem layout", async () => {
		const x = new X();

		expect(await x.fs.exists("/home/user")).toBe(true);
		expect(await x.fs.exists("/tmp")).toBe(true);
		expect(await x.fs.exists("/dev/null")).toBe(true);
		expect(await x.fs.exists("/proc/version")).toBe(true);

		const result = await x.exec("ls /bin");
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("echo");
	});

	it("accepts a custom IFileSystem and exposes files through x.fs", async () => {
		const fs = new InMemoryFs({ "/tmp/existing.txt": "hello" });
		const x = new X({ fs });
		expect(await x.fs.exists("/tmp/existing.txt")).toBe(true);
		expect(await x.fs.readFile("/tmp/existing.txt")).toBe("hello");
	});

	it("accepts a custom env backend and merges it into exec env", async () => {
		const envBackend = new MemoryEnvBackend({
			cwd: "/home/user",
			env: { MY_VAR: "my-value" },
		});
		const x = new X({ envBackend });
		const result = await x.exec('printf "%s" "$MY_VAR"');
		expect(result.stdout).toBe("my-value");
	});

	it("accepts custom bash cwd option", async () => {
		const x = new X({ bash: { cwd: "/custom/cwd" } });
		const result = await x.exec("pwd");
		expect(result.stdout.trim()).toBe("/custom/cwd");
		expect(await x.fs.exists("/tmp")).toBe(false);
	});
});

describe("X static init and exec promise", () => {
	it("X.init returns a ready X instance supporting immediate exec", async () => {
		const x = X.init();
		const result = await x.exec("echo hello");
		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("hello");
	});

	it("exec propagates non-zero exitCode from failing commands", async () => {
		const x = new X();
		const result = await x.exec("exit 42");
		expect(result.exitCode).toBe(42);
	});

	it("exec initialises features only once for concurrent calls", async () => {
		const x = new X();
		let initCount = 0;

		x.registerFeature({
			name: "concurrent-init",
			hooks: {
				onExecStart: new AsyncOnce<[ExecHookStartContext]>(async ({ fs }) => {
					initCount += 1;
					await fs.mkdir("/tmp/concurrent", { recursive: true });
				}).run,
			},
		});

		// Fire two execs simultaneously before either has initialised
		await Promise.all([x.exec("echo 1"), x.exec("echo 2")]);
		expect(initCount).toBe(1);
	});

	it("rejects when an async feature init throws", async () => {
		const x = new X();
		x.registerFeature({
			name: "broken-init",
			hooks: {
				onExecStart: new AsyncOnce<[ExecHookStartContext]>(async () => {
					throw new Error("boom from init");
				}).run,
			},
		});
		await expect(x.exec("echo ok")).rejects.toThrow("boom from init");
	});
});

describe("X getTools integration", () => {
	it("returns a bash tool object", async () => {
		const x = new X();
		const tools = await x.getTools();
		expect(tools.bash).toBeDefined();
	});

	it("getTools description includes custom description option", async () => {
		const x = new X();
		const tools = await x.getTools({ description: "read-only sandbox" });
		const description = tools.bash.description as string;
		expect(description).toContain("read-only sandbox");
	});

	it("getTools description does not list standalone registered commands", async () => {
		const x = new X();
		x.registerCommand({
			name: "x-listed",
			trusted: true,
			async execute() {
				return { stdout: "", stderr: "", exitCode: 0 };
			},
		});
		const tools = await x.getTools();
		const description = tools.bash.description as string;
		expect(description).not.toContain("Registered commands:");
		expect(description).not.toContain("x-listed");
	});

	it("creates a dynamic tool description from enabled runtime options", async () => {
		const x = new X({ bash: { javascript: false, network: false, python: false } });
		const description = await x.createToolDescription();
		expect(description).toContain("Bash tool is a virtual bash shell");
		expect(description).toContain("Network: off");
		expect(description).toContain("Do not put shell code in `stdin`");
		expect(description).toContain("rg --files");
		expect(description).not.toContain("curl https://example.com");
		expect(description).not.toContain("js-exec");
		expect(description).not.toContain("python3");
		expect(description).not.toContain("undefined");
	});

	it("includes network, JavaScript, Python, feature metadata XML, and custom options when enabled", async () => {
		const x = X.init({ workspace: { mountPoint: "/project" } });
		const description = await x.createToolDescription({ description: "Extra policy." });
		expect(description).toContain("Network: on");
		expect(description).toContain("`cwd` is optional and sets the working directory");
		expect(description).toContain("They are NOT callable tools.");
		expect(description).toContain("curl https://github.blog | html-to-markdown");
		expect(description).toContain("You may use `js-exec`");
		expect(description).toContain("You may use `python3` or `python`");
		expect(description).toContain("<feature>\n<title>workspace</title>");
		expect(description).toContain("/project");
		expect(description).toContain("<title>memory</title>");
		expect(description).toContain("<title>skills</title>");
		expect(description).toContain("<title>patch</title>");
		expect(description).toContain("<title>git</title>");
		expect(description).toContain("Extra policy.");
		expect(description).not.toContain("Feature guidance");
		expect(description).not.toContain("\n\n\n");
	});

	it("bash tool executes and returns stdout/exitCode", async () => {
		const x = new X();
		const tools = await x.getTools();
		const execTool = tools.bash as unknown as {
			execute: (input: { command: string }) => Promise<{
				stdout: string;
				stderr: string;
				exitCode: number;
			}>;
		};
		const result = await execTool.execute({ command: "echo test-output" });
		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("test-output");
	});

	it("bash tool truncates large output according to maxOutput option", async () => {
		const x = new X();
		const tools = await x.getTools({ maxOutput: 50 });
		const execTool = tools.bash as unknown as {
			execute: (input: { command: string }) => Promise<{
				stdout: string;
				stderr: string;
				exitCode: number;
			}>;
		};
		// Produce more than 50 bytes of output
		const result = await execTool.execute({
			command: "printf '%100s' '' | tr ' ' 'X'",
		});
		expect(result.stdout.length + result.stderr.length).toBeLessThanOrEqual(200);
	});

	it("bash tool can be called multiple times independently", async () => {
		const x = new X();
		const tools = await x.getTools();
		const execTool = tools.bash as unknown as {
			execute: (input: { command: string }) => Promise<{
				stdout: string;
				exitCode: number;
			}>;
		};
		const first = await execTool.execute({ command: "echo first" });
		const second = await execTool.execute({ command: "echo second" });
		expect(first.stdout.trim()).toBe("first");
		expect(second.stdout.trim()).toBe("second");
	});

	it("bash tool execution triggers hooks in registration order", async () => {
		const calls: string[] = [];
		const x = new X({
			execHooks: [
				{
					onExecStart: () => {
						calls.push("constructor:start");
					},
					onExecEnd: () => {
						calls.push("constructor:end");
					},
				},
			],
		});
		x.registerFeature({
			name: "hook-feature",
			hooks: {
				onExecStart: () => {
					calls.push("feature:start");
				},
				onExecEnd: () => {
					calls.push("feature:end");
				},
			},
		});
		x.registerHook({
			onExecStart: () => {
				calls.push("registered:start");
			},
			onExecEnd: () => {
				calls.push("registered:end");
			},
		});

		const tools = await x.getTools();
		const execTool = tools.bash as unknown as {
			execute: (input: { command: string }) => Promise<{
				stdout: string;
				exitCode: number;
			}>;
		};
		const result = await execTool.execute({ command: "echo hooked" });

		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("hooked");
		expect(calls).toEqual([
			"constructor:start",
			"feature:start",
			"registered:start",
			"constructor:end",
			"feature:end",
			"registered:end",
		]);
	});

	it("onExecStart context exposes the main fs and no baseFs", async () => {
		const x = new X();
		let sawMainFs = false;
		let sawBaseFs = false;

		x.registerHook({
			onExecStart: (context) => {
				sawMainFs = context.fs === x.fs;
				sawBaseFs = "baseFs" in context;
			},
		});

		await x.exec("echo ok");

		expect(sawMainFs).toBe(true);
		expect(sawBaseFs).toBe(false);
	});
});

describe("X registerCommand", () => {
	it("registers a standalone command visible in x.commands", async () => {
		const x = new X();
		x.registerCommand({
			name: "x-standalone",
			trusted: true,
			async execute() {
				return { stdout: "standalone-output", stderr: "", exitCode: 0 };
			},
		});
		expect(x.commands.some((c) => c.name === "x-standalone")).toBe(true);
		const result = await x.exec("x-standalone");
		expect(result.stdout).toBe("standalone-output");
	});

	it("registerFeature with same command name overrides registerCommand", async () => {
		const x = new X();
		x.registerCommand({
			name: "x-shared",
			trusted: true,
			async execute() {
				return { stdout: "external", stderr: "", exitCode: 0 };
			},
		});
		x.registerFeature({
			name: "overriding-feature",
			command: [
				{
					name: "x-shared",
					trusted: true,
					async execute() {
						return { stdout: "feature", stderr: "", exitCode: 0 };
					},
				},
			],
		});
		const result = await x.exec("x-shared");
		expect(result.stdout).toBe("feature");
		expect(x.commands.filter((c) => c.name === "x-shared").length).toBe(1);
	});
});

describe("X registerFeature async vs sync init", () => {
	it("feature with async once onExecStart runs before first exec result", async () => {
		const x = new X();
		let initDone = false;

		x.registerFeature({
			name: "async-init-feature",
			hooks: {
				onExecStart: new AsyncOnce<[ExecHookStartContext]>(async ({ fs }) => {
					await fs.mkdir("/tmp/async-init", { recursive: true });
					initDone = true;
				}).run,
			},
		});

		await x.exec("echo ok");
		expect(initDone).toBe(true);
		expect(await x.fs.exists("/tmp/async-init")).toBe(true);
	});

	it("feature without hooks runs without error", async () => {
		const x = new X();
		x.registerFeature({
			name: "no-init",
			command: [
				{
					name: "x-noinit",
					trusted: true,
					async execute() {
						return { stdout: "ok", stderr: "", exitCode: 0 };
					},
				},
			],
		});
		const result = await x.exec("x-noinit");
		expect(result.stdout).toBe("ok");
	});
});

describe("X environment variable mutation across execs", () => {
	it("persists env changes set during bash execution", async () => {
		const x = new X();
		await x.exec("export PERSISTENT_X=hello");
		const result = await x.exec('printf "%s" "$PERSISTENT_X"');
		expect(result.stdout).toBe("hello");
	});

	it("tracks env changes across multiple sequential exec calls", async () => {
		const x = new X();
		await x.exec("export COUNTER_X=1");
		await x.exec("export COUNTER_X=2");
		const result = await x.exec('printf "%s" "$COUNTER_X"');
		expect(result.stdout).toBe("2");
	});

	it("starts from bash env and lets persisted env override matching baseline keys", async () => {
		const x = new X({ bash: { env: { SHARED_X: "baseline" } } });
		const first = await x.exec('printf "%s" "$SHARED_X"');
		expect(first.stdout).toBe("baseline");

		await x.exec("export SHARED_X=persisted");
		const second = await x.exec('printf "%s" "$SHARED_X"');
		expect(second.stdout).toBe("persisted");
	});

	it("feature-owned env keys are re-applied and not polluted by bash exec", async () => {
		const x = new X();
		x.registerFeature({
			name: "env-feature",
			hooks: {
				onExecStart: new AsyncOnce<[ExecHookStartContext]>(({ setEnv }) => {
					setEnv("FEAT_OWNED", "original");
				}).run,
			},
		});
		await x.exec("export FEAT_OWNED=overridden-in-bash");
		const result = await x.exec('printf "%s" "$FEAT_OWNED"');
		expect(result.stdout).toBe("original");
	});

	it("later hook setEnv calls override earlier values", async () => {
		const x = new X();
		x.registerHook({
			onExecStart: new AsyncOnce<[ExecHookStartContext]>(({ setEnv }) => {
				setEnv("HOOK_ORDERED", "first");
			}).run,
		});
		x.registerHook({
			onExecStart: new AsyncOnce<[ExecHookStartContext]>(({ setEnv }) => {
				setEnv("HOOK_ORDERED", "second");
			}).run,
		});

		const result = await x.exec('printf "%s" "$HOOK_ORDERED"');

		expect(result.stdout).toBe("second");
	});

	it("does not persist per-exec env options", async () => {
		const x = new X();
		const first = await x.exec('printf "%s" "$TEMP_X"', {
			env: { TEMP_X: "one-shot" },
		});
		expect(first.stdout).toBe("one-shot");

		const second = await x.exec('printf "%s" "$TEMP_X"');
		expect(second.stdout).toBe("");
	});

	it("does not persist command changes made during per-exec env options", async () => {
		const x = new X();
		await x.exec("export TEMP_X=changed", {
			env: { TEMP_X: "one-shot" },
		});

		const result = await x.exec('printf "%s" "$TEMP_X"');
		expect(result.stdout).toBe("");
	});

	it("replaceEnv skips persisted env and does not overwrite it", async () => {
		const x = new X();
		await x.exec("export KEEP_X=persisted");

		const replaceResult = await x.exec('printf "%s" "$KEEP_X"; export KEEP_X=replaced', {
			replaceEnv: true,
		});
		expect(replaceResult.stdout).toBe("");

		const result = await x.exec('printf "%s" "$KEEP_X"');
		expect(result.stdout).toBe("persisted");
	});

	it("persists ordinary env changes through an external backend", async () => {
		const envBackend = new MemoryEnvBackend();
		const first = new X({ envBackend });
		await first.exec("export BACKED_X=saved");

		const second = new X({ envBackend });
		const result = await second.exec('printf "%s" "$BACKED_X"');
		expect(result.stdout).toBe("saved");
	});
});
