import { describe, expect, it } from "bun:test";
import { InMemoryFs, MountableFs } from "just-bash";
import {
	initializeMountedFeature,
	resolveFeatureEnabled,
	resolveFeatureOption,
	resolveMountedFeatureConfig,
} from "@/runtime/features";

function createMockBash() {
	return {
		registerCommand() {},
		getCwd: () => "/home/user",
	} as unknown as import("just-bash").Bash;
}

describe("resolveFeatureEnabled", () => {
	it("returns true for undefined", () => {
		expect(resolveFeatureEnabled(undefined)).toBe(true);
	});
	it("returns true for true", () => {
		expect(resolveFeatureEnabled(true)).toBe(true);
	});
	it("returns false for false", () => {
		expect(resolveFeatureEnabled(false)).toBe(false);
	});
	it("returns true for an options object", () => {
		expect(resolveFeatureEnabled({ mountPoint: "/custom" })).toBe(true);
	});
});

describe("resolveFeatureOption", () => {
	it("returns undefined for boolean true", () => {
		expect(resolveFeatureOption<{ mountPoint: string }>(true)).toBeUndefined();
	});
	it("returns undefined for boolean false", () => {
		expect(resolveFeatureOption<{ mountPoint: string }>(false)).toBeUndefined();
	});
	it("returns the options object when provided", () => {
		const opts = { mountPoint: "/custom" };
		expect(resolveFeatureOption(opts)).toBe(opts);
	});
});

describe("resolveMountedFeatureConfig", () => {
	it("uses default mount when option is true", () => {
		const cfg = resolveMountedFeatureConfig(true, "/default");
		expect(cfg.enabled).toBe(true);
		expect(cfg.mountPoint).toBe("/default");
		expect(cfg.fs).toBeUndefined();
	});

	it("uses default mount when option is undefined", () => {
		const cfg = resolveMountedFeatureConfig(undefined, "/default");
		expect(cfg.enabled).toBe(true);
		expect(cfg.mountPoint).toBe("/default");
	});

	it("disabled when option is false", () => {
		const cfg = resolveMountedFeatureConfig(false, "/default");
		expect(cfg.enabled).toBe(false);
	});

	it("uses provided mountPoint from options object", () => {
		const cfg = resolveMountedFeatureConfig({ mountPoint: "/custom" }, "/default");
		expect(cfg.mountPoint).toBe("/custom");
	});

	it("uses provided fs from options object", () => {
		const customFs = new InMemoryFs();
		const cfg = resolveMountedFeatureConfig({ fs: customFs }, "/default");
		expect(cfg.fs).toBe(customFs);
	});
});

describe("initializeMountedFeature", () => {
	it("mounts custom fs when config.fs is provided", async () => {
		const sourceFs = new InMemoryFs();
		const fs = new MountableFs({ base: sourceFs });
		const customFs = new InMemoryFs({ "/file.txt": "content" });

		await initializeMountedFeature(
			{ fs, bash: createMockBash(), setEnv: () => {} },
			{ enabled: true, fs: customFs, mountPoint: "/mnt/data" },
			"/mnt/data",
		);
		expect(await fs.exists("/mnt/data/file.txt")).toBe(true);
	});

	it("creates directory in the main fs when config.fs is absent", async () => {
		const sourceFs = new InMemoryFs();
		const fs = new MountableFs({ base: sourceFs });

		await initializeMountedFeature(
			{ fs, bash: createMockBash(), setEnv: () => {} },
			{ enabled: true, mountPoint: "/home/user/memory" },
			"/home/user/memory",
		);
		expect(await fs.exists("/home/user/memory")).toBe(true);
	});

	it("does nothing when config.enabled is false", async () => {
		const sourceFs = new InMemoryFs();
		const fs = new MountableFs({ base: sourceFs });

		await initializeMountedFeature(
			{ fs, bash: createMockBash(), setEnv: () => {} },
			{ enabled: false, mountPoint: "/mnt/data" },
			"/mnt/data",
		);
		expect(await fs.exists("/mnt/data")).toBe(false);
	});
});
