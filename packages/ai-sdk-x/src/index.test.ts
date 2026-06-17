import { describe, expect, it } from "bun:test";
import X, {
	BootstrappableMountableFs,
	type CliCommandDefinition,
	createCommand,
	createGitFeature,
	createMemoryFeature,
	createPatchFeature,
	createSkillsFeature,
	createWorkspaceFeature,
	defineCliCommand,
	type EnvBackend,
	type Feature,
	type FeatureSetupContext,
	type IFileSystem,
	InMemoryFs,
	InMemoryKVStore,
	type KVStorage,
	MemoryEnvBackend,
	MountableFs,
	ReadWriteFs,
	type XOptions,
} from "@/index";
import { AsyncOnce } from "@/runtime/async-once";
import type { ExecHookStartContext } from "@/types";

describe("public exports", () => {
	it("exports runtime, fs, storage, feature, and CLI building APIs", () => {
		const fs: IFileSystem = new InMemoryFs();
		const storage: KVStorage = new InMemoryKVStore();
		const envBackend: EnvBackend = new MemoryEnvBackend();
		const options: XOptions = { envBackend, fs };
		const feature: Feature = {
			name: "typed",
			hooks: {
				onExecStart(ctx: FeatureSetupContext) {
					ctx.setEnv("TYPED_FEATURE", "1");
				},
			},
		};
		const cliDefinition: CliCommandDefinition = defineCliCommand({
			id: "x-public",
			type: "command",
			run: () => ({ stdout: "ok", stderr: "", exitCode: 0 }),
		});

		expect(new X(options)).toBeInstanceOf(X);
		expect(fs).toBeInstanceOf(InMemoryFs);
		expect(storage).toBeInstanceOf(InMemoryKVStore);
		expect(envBackend).toBeInstanceOf(MemoryEnvBackend);
		expect(feature.name).toBe("typed");
		expect(createCommand(cliDefinition).name).toBe("x-public");
		expect(createGitFeature().name).toBe("git");
		expect(createMemoryFeature().name).toBe("memory");
		expect(createPatchFeature().name).toBe("patch");
		expect(createSkillsFeature().name).toBe("skills");
		expect(createWorkspaceFeature().name).toBe("workspace");
		expect(new MountableFs({ base: new InMemoryFs() })).toBeInstanceOf(MountableFs);
		expect(new BootstrappableMountableFs({ base: new InMemoryFs() })).toBeInstanceOf(
			BootstrappableMountableFs,
		);
		expect(typeof ReadWriteFs).toBe("function");
	});
});

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
		expect(installResult.stdout).toContain("Skill installed successfully.");
		expect(installResult.stdout).toContain("Skills Name: demo");
		expect(installResult.stdout).toContain("Source: /origin");
		expect(installResult.stdout).toContain("Skill File: $SKILLS_HOME/demo/SKILL.md");
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
		expect(updateResult.stdout).toContain("Update `demo` successfully.");
		expect(updateResult.stdout).toContain("Total updated skills: 1");
		expect(await x.fs.readFile("/home/user/skills/demo/SKILL.md")).toContain("Version 2");

		const infoResult = await x.exec("x-skills info demo");
		expect(infoResult.stdout).toContain("Title: demo");
		expect(infoResult.stdout).toContain("Source: git");
		expect(infoResult.stdout).toContain("File Path: $SKILLS_HOME/demo/SKILL.md");

		const removeResult = await x.exec("x-skills remove -y demo");
		expect(removeResult.exitCode).toBe(0);
		expect(removeResult.stdout).toContain("Remove `demo` successfully.");
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

	it("getTools description includes external description option", async () => {
		const x = new X();
		const tools = await x.getTools({ externalDescription: "read-only sandbox" });
		const description = tools.bash.description as string;
		expect(description).toContain("read-only sandbox");
	});

	it("getTools can omit the full generated description for system prompt usage", async () => {
		const x = X.init();
		const tools = await x.getTools({ enableDescription: false });
		const description = tools.bash.description as string;
		expect(description).toBeString();
		expect(description.length).toBeGreaterThan(0);
		expect(description).not.toContain("<bash_tool>");
		expect(description).not.toContain("<bash_tool_guidance>");
		expect(description).toContain("<feature:workspace>");
	});

	it("getInstructions splits guidance and environment", async () => {
		const x = X.init({ workspace: { mountPoint: "/project" } });
		const instructions = await x.getInstructions({ externalDescription: "Extra policy." });

		expect(instructions.guidance).toContain("<bash_tool_guidance>");
		expect(instructions.guidance).toContain("Use structured tools when appropriate");
		expect(instructions.guidance).toContain("<feature:patch>");
		expect(instructions.guidance).toContain("<feature:git>");
		expect(instructions.guidance).not.toContain("/project");

		expect(instructions.environment).toContain("<bash_tool_environment>");
		expect(instructions.environment).toContain("initial cwd:");
		expect(instructions.environment).toContain("<feature:workspace>");
		expect(instructions.environment).toContain("/project");
		expect(instructions.environment).toContain("Extra policy.");
		expect(instructions.environment).not.toContain("Use structured tools when appropriate");

		expect(Object.keys(instructions).sort()).toEqual(["environment", "guidance"]);
	});

	it("getTools with enableDescription false only uses environment instructions", async () => {
		const x = X.init({ workspace: { mountPoint: "/project" } });
		const tools = await x.getTools({ enableDescription: false });
		const description = tools.bash.description as string;

		expect(description).toContain("<bash_tool_environment>");
		expect(description).toContain("/project");
		expect(description).not.toContain("<bash_tool_guidance>");
		expect(description).not.toContain("Use structured tools when appropriate");
	});

	it("getTools passes needsApproval to the bash tool", async () => {
		const x = new X();
		const needsApproval = ({ command }: { command: string }) => command.startsWith("rm ");
		const tools = await x.getTools({ needsApproval });

		const approval = (tools.bash as unknown as { needsApproval: typeof needsApproval })
			.needsApproval;
		expect(approval({ command: "rm -rf tmp" })).toBe(true);
		expect(approval({ command: "pwd" })).toBe(false);
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
		expect(description).toStartWith("<bash_tool_guidance>");
		expect(description).toContain("<bash_tool_environment>");
		expect(description).not.toContain("<network>");
		expect(description).not.toContain("<javascript>");
		expect(description).not.toContain("<python>");
		expect(description).not.toContain("undefined");
		expect(description).toContain("</bash_tool_guidance>\n\n<bash_tool_environment>");
		expect(description).toContain("</bash_tool_environment>");
		expect(description).toEndWith("</bash_tool_environment>");
	});

	it("includes network, JavaScript, Python, feature metadata XML, and custom options when enabled", async () => {
		const x = X.init({ workspace: { mountPoint: "/project" } });
		const description = await x.createToolDescription({ externalDescription: "Extra policy." });
		expect(description).toContain("<network>");
		expect(description).toContain("</network>");
		expect(description).toContain("<javascript>");
		expect(description).toContain("</javascript>");
		expect(description).toContain("<python>");
		expect(description).toContain("</python>");
		expect(description).toContain("<feature:workspace>");
		expect(description).toContain("</feature:workspace>");
		expect(description).toContain("/project");
		expect(description).toContain("<feature:memory>");
		expect(description).toContain("</feature:memory>");
		expect(description).toContain("<feature:skills>");
		expect(description).toContain("</feature:skills>");
		expect(description).toContain("<feature:patch>");
		expect(description).toContain("</feature:patch>");
		expect(description).toContain("<feature:git>");
		expect(description).toContain("</feature:git>");
		expect(description).toContain("Extra policy.");
		expect(description).not.toContain("\n\n\n");
	});

	it("createToolDescription returns the combined instruction bundle", async () => {
		const x = X.init({ workspace: { mountPoint: "/project" } });
		const description = await x.createToolDescription({ externalDescription: "Extra policy." });

		expect(description).toContain("<bash_tool_guidance>");
		expect(description).toContain("<bash_tool_environment>");
		expect(description).toContain("Extra policy.");
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

	it("bash tool description stays static while execution follows persisted cwd", async () => {
		const x = new X();
		const tools = await x.getTools();
		const description = tools.bash.description as string;
		const execTool = tools.bash as unknown as {
			execute: (input: { command: string }) => Promise<{
				stdout: string;
				exitCode: number;
			}>;
		};

		await execTool.execute({ command: "mkdir -p /tmp/demo && cd /tmp/demo" });
		const result = await execTool.execute({ command: "pwd" });

		expect(description).toContain("initial cwd: /home/user");
		expect(result.exitCode).toBe(0);
		expect(result.stdout.trim()).toBe("/tmp/demo");
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
