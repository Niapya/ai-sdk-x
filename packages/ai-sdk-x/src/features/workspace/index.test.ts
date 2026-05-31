import { describe, expect, it } from "bun:test";
import { Bash, InMemoryFs, MountableFs } from "just-bash";
import { createWorkspaceFeature, DEFAULT_WORKSPACE_MOUNT } from "@/features/workspace";
import X from "@/index";

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

	it("description includes the mount point path and bash usage guidance", async () => {
		const feature = createWorkspaceFeature(true);
		const ctx = makeInitCtx();
		const text = await feature.description?.(ctx);
		expect(text).toContain(DEFAULT_WORKSPACE_MOUNT);
		expect(text).toContain("ALL DURABLE WORK FILES AND DELIVERABLES");
		expect(text).toContain("WORKSPACE_HOME");
		expect(text).toContain("The current workspace file tree, shown up to 5 levels deep:");
		expect(text).toContain(`${DEFAULT_WORKSPACE_MOUNT}\n\n0 directories, 0 files`);
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
		const text = await feature.description?.(makeInitCtx(fs));

		expect(text).toContain("|-- a.txt");
		expect(text).toContain("|-- dir");
		expect(text).toContain("`-- b.txt");
		expect(text).toContain("`-- five.txt");
		expect(text).toContain("|-- five");
		expect(text).not.toContain("six.txt");
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
