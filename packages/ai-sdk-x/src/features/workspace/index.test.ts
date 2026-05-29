import { describe, expect, it } from "bun:test";
import { InMemoryFs, MountableFs } from "just-bash";
import { createWorkspaceFeature, DEFAULT_WORKSPACE_MOUNT } from "@/features/workspace";

function makeInitCtx(fs = new MountableFs({ base: new InMemoryFs() })) {
	const env = new Map<string, string>();
	return {
		fs,
		bash: { registerCommand: () => {} } as unknown as import("just-bash").Bash,
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
		const text = await feature.description?.({} as never);
		expect(text).toContain(DEFAULT_WORKSPACE_MOUNT);
		expect(text).toContain("not a separate callable tool");
		expect(text).toContain("WORKSPACE_HOME");
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
});
