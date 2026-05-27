import { describe, expect, it } from "bun:test";
import { InMemoryFs, MountableFs } from "just-bash";
import { createWorkspaceFeature } from "@/features/workspace";
import { DEFAULT_WORKSPACE_MOUNT } from "@/runtime/constants";

function makeInitCtx(baseFs: InMemoryFs) {
	const fs = new MountableFs({ base: baseFs });
	return {
		baseFs,
		fs,
		bash: { registerCommand: () => {} } as unknown as import("just-bash").Bash,
	};
}

describe("createWorkspaceFeature", () => {
	it("has name 'workspace'", () => {
		expect(createWorkspaceFeature(true).name).toBe("workspace");
		expect(createWorkspaceFeature(false).name).toBe("workspace");
	});

	it("returns bare feature (no prompt/env/init) when disabled", () => {
		const feature = createWorkspaceFeature(false);
		expect(feature.prompt).toBeUndefined();
		expect(feature.env).toBeUndefined();
		expect(feature.init).toBeUndefined();
	});

	it("provides prompt, env, and init when enabled", () => {
		const feature = createWorkspaceFeature(true);
		expect(typeof feature.prompt).toBe("function");
		expect(feature.env).toBeDefined();
		expect(typeof feature.init).toBe("function");
	});

	it("prompt includes the mount point path", async () => {
		const feature = createWorkspaceFeature(true);
		const text = await feature.prompt?.({} as never);
		expect(text).toContain(DEFAULT_WORKSPACE_MOUNT);
	});

	it("sets WORKSPACE_HOME env var to the mount point", () => {
		const feature = createWorkspaceFeature(true);
		expect(feature.env?.WORKSPACE_HOME).toBe(DEFAULT_WORKSPACE_MOUNT);
	});

	it("uses custom mountPoint from options", () => {
		const feature = createWorkspaceFeature({ mountPoint: "/custom/ws" });
		expect(feature.env?.WORKSPACE_HOME).toBe("/custom/ws");
	});

	it("init creates the mount directory in baseFs (no custom fs)", async () => {
		const baseFs = new InMemoryFs();
		const feature = createWorkspaceFeature(true);
		await feature.init?.(makeInitCtx(baseFs));
		expect(await baseFs.exists(DEFAULT_WORKSPACE_MOUNT)).toBe(true);
	});

	it("init mounts custom fs at the mountPoint", async () => {
		const baseFs = new InMemoryFs();
		const customFs = new InMemoryFs({ "/file.txt": "hello" });
		const feature = createWorkspaceFeature({ mountPoint: "/mnt/ws", fs: customFs });
		const ctx = makeInitCtx(baseFs);
		await feature.init?.(ctx);
		expect(await ctx.fs.exists("/mnt/ws/file.txt")).toBe(true);
	});
});
