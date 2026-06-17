import { describe, expect, it } from "bun:test";
import { Bash, InMemoryFs, MountableFs } from "just-bash";
import { createWorkspaceFeature, DEFAULT_WORKSPACE_MOUNT } from "@/features/workspace";
import X from "@/index";
import type { FeatureInstructions } from "@/types";

function makeInitCtx(fs = new MountableFs({ base: new InMemoryFs() })) {
	const env = new Map<string, string>();
	return {
		fs,
		bash: new Bash({ fs }),
		setEnv: (key: string, value: string) => {
			env.set(key, value);
		},
		env,
	};
}

function expectInstructions(value: unknown): FeatureInstructions {
	expect(typeof value).toBe("object");
	expect(value).not.toBeNull();
	return value as FeatureInstructions;
}

describe("createWorkspaceFeature", () => {
	it("has name 'workspace'", () => {
		expect(createWorkspaceFeature(true).name).toBe("workspace");
		expect(createWorkspaceFeature(false).name).toBe("workspace");
	});

	it("returns bare feature (no prompt/hooks) when disabled", () => {
		const feature = createWorkspaceFeature(false);
		expect(feature.description).toBeUndefined();
		expect(feature.hooks).toBeUndefined();
	});

	it("provides description and onExecStart hook when enabled", () => {
		const feature = createWorkspaceFeature(true);
		expect(typeof feature.description).toBe("function");
		expect(typeof feature.hooks?.onExecStart).toBe("function");
	});

	it("loads root agents instructions files into environment by default", async () => {
		const base = new InMemoryFs({
			"/home/user/workspace/agents.md": "# Workspace Agent\nRead this first.",
		});
		const feature = createWorkspaceFeature(true);
		const description = expectInstructions(
			await feature.description?.(makeInitCtx(new MountableFs({ base }))),
		);

		expect(description.guidance).toContain("workspace root `agents.md` file");
		expect(description.environment).toContain(
			"Workspace root agent instructions file `/home/user/workspace/agents.md` is as follows:",
		);
		expect(description.environment).toContain("/home/user/workspace/agents.md");
		expect(description.environment).toContain("Read this first.");
	});

	it("matches the known agent filenames case-insensitively and only reads the workspace root", async () => {
		const base = new InMemoryFs({
			"/home/user/workspace/AGENTS.MD": "# Upper Case\nUse this.",
			"/home/user/workspace/subproject/AGENTS.md": "# Nested\nDo not preload this.",
		});
		const feature = createWorkspaceFeature(true);
		const description = expectInstructions(
			await feature.description?.(makeInitCtx(new MountableFs({ base }))),
		);

		expect(description.environment).toContain("/home/user/workspace/AGENTS.MD");
		expect(description.environment).toContain(
			"Workspace root agent instructions file `/home/user/workspace/AGENTS.MD` is as follows:",
		);
		expect(description.environment).toContain("Use this.");
		expect(description.environment).not.toContain("Do not preload this.");
	});

	it("falls back to agent.md and then claude.md", async () => {
		const agentBase = new InMemoryFs({
			"/home/user/workspace/agent.md": "# Agent Workspace\nFallback content.",
			"/home/user/workspace/claude.md": "# Claude Workspace\nDo not use this.",
		});
		const agentFeature = createWorkspaceFeature(true);
		const agentDescription = expectInstructions(
			await agentFeature.description?.(makeInitCtx(new MountableFs({ base: agentBase }))),
		);

		expect(agentDescription.environment).toContain("/home/user/workspace/agent.md");
		expect(agentDescription.environment).toContain("Fallback content.");
		expect(agentDescription.environment).not.toContain("Do not use this.");

		const base = new InMemoryFs({
			"/home/user/workspace/claude.md": "# Claude Workspace\nClaude content.",
		});
		const feature = createWorkspaceFeature(true);
		const description = expectInstructions(
			await feature.description?.(makeInitCtx(new MountableFs({ base }))),
		);

		expect(description.environment).toContain("/home/user/workspace/claude.md");
		expect(description.environment).toContain("Claude content.");
	});

	it("can disable loading agents instructions files", async () => {
		const base = new InMemoryFs({
			"/home/user/workspace/agents.md": "# Workspace Agent\nRead this first.",
		});
		const feature = createWorkspaceFeature({ loadAgentsMd: false });
		const description = expectInstructions(
			await feature.description?.(makeInitCtx(new MountableFs({ base }))),
		);

		expect(description.environment).not.toContain("Workspace root agent instructions file:");
		expect(description.environment).not.toContain("Read this first.");
	});

	it("description includes the mount point path and bash usage guidance", async () => {
		const feature = createWorkspaceFeature(true);
		const ctx = makeInitCtx();
		const description = await feature.description?.(ctx);
		expect(typeof description).toBe("object");
		const text = description as { guidance: string; environment: string };
		expect(text.environment).toContain(DEFAULT_WORKSPACE_MOUNT);
		expect(text.guidance).toContain("ALL DURABLE WORK FILES AND DELIVERABLES");
		expect(text.guidance).toContain("WORKSPACE_HOME");
		expect(text.environment).toContain("```text");
		expect(text.environment).toContain("```");
		expect(text.environment).toContain(`${DEFAULT_WORKSPACE_MOUNT}\n\n0 directories, 0 files`);
	});

	it("description embeds a tree output for workspace files up to 5 levels deep", async () => {
		const base = new InMemoryFs({
			"/home/user/workspace/a.txt": "a",
			"/home/user/workspace/dir/b.txt": "b",
			"/home/user/workspace/one/two/three/four/five.txt": "five",
			"/home/user/workspace/one/two/three/four/five/six.txt": "six",
		});
		const fs = new MountableFs({ base });
		const feature = createWorkspaceFeature(true);
		const description = await feature.description?.(makeInitCtx(fs));
		expect(typeof description).toBe("object");
		const text = (description as { environment: string }).environment;

		expect(text).toContain("|-- a.txt");
		expect(text).toContain("|-- dir");
		expect(text).toContain("`-- b.txt");
		expect(text).toContain("`-- five.txt");
		expect(text).toContain("|-- five");
		expect(text).not.toContain("six.txt");
	});

	it("uses a custom workspace tree max depth", async () => {
		const base = new InMemoryFs({
			"/home/user/workspace/dir/nested/file.txt": "file",
		});
		const fs = new MountableFs({ base });
		const feature = createWorkspaceFeature({ treeMaxDepth: 1 });
		const description = expectInstructions(await feature.description?.(makeInitCtx(fs)));

		expect(description.environment).toContain("`-- dir");
		expect(description.environment).not.toContain("nested");
		expect(description.environment).not.toContain("file.txt");
	});

	it("onExecStart creates the mount directory and sets env", async () => {
		const fs = new MountableFs({ base: new InMemoryFs() });
		const feature = createWorkspaceFeature(true);
		const ctx = makeInitCtx(fs);
		await feature.hooks?.onExecStart?.({
			...ctx,
			command: "echo ok",
			snapshot: { cwd: "/", env: {} },
		});
		expect(await fs.exists(DEFAULT_WORKSPACE_MOUNT)).toBe(true);
		expect(ctx.env.get("WORKSPACE_HOME")).toBe(DEFAULT_WORKSPACE_MOUNT);
	});

	it("onExecStart uses custom mountPoint from options", async () => {
		const feature = createWorkspaceFeature({ mountPoint: "/custom/ws" });
		const ctx = makeInitCtx();
		await feature.hooks?.onExecStart?.({
			...ctx,
			command: "echo ok",
			snapshot: { cwd: "/", env: {} },
		});
		expect(ctx.env.get("WORKSPACE_HOME")).toBe("/custom/ws");
	});

	it("onExecStart mounts custom fs at the mountPoint", async () => {
		const fs = new MountableFs({ base: new InMemoryFs() });
		const customFs = new InMemoryFs({ "/file.txt": "hello" });
		const feature = createWorkspaceFeature({ mountPoint: "/mnt/ws", fs: customFs });
		const ctx = makeInitCtx(fs);
		await feature.hooks?.onExecStart?.({
			...ctx,
			command: "echo ok",
			snapshot: { cwd: "/", env: {} },
		});
		expect(await ctx.fs.exists("/mnt/ws/file.txt")).toBe(true);
	});

	it("custom workspace fs stays mounted after description generation", async () => {
		const x = X.init({
			git: false,
			memory: false,
			patch: false,
			skills: false,
			workspace: {
				fs: new InMemoryFs({ "/file.txt": "hello" }),
			},
		});

		const description = await x.createToolDescription();
		expect(description).toContain("`-- file.txt");

		const result = await x.exec("ls $WORKSPACE_HOME");
		expect(result.stdout).toBe("file.txt\n");
	});

	it("uses the main X filesystem workspace directory when no feature fs is provided", async () => {
		const x = X.init({
			git: false,
			memory: false,
			patch: false,
			skills: false,
		});
		await x.fs.mkdir("/home/user/workspace", { recursive: true });
		await x.fs.writeFile("/home/user/workspace/main.txt", "from main fs");

		const description = await x.createToolDescription();
		expect(description).toContain("`-- main.txt");

		const result = await x.exec("ls $WORKSPACE_HOME");
		expect(result.stdout).toBe("main.txt\n");
	});
});
