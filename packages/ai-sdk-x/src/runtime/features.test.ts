import { describe, expect, it } from "bun:test";
import { InMemoryFs, MountableFs } from "just-bash";
import { resolveBashConfig } from "@/runtime/config";
import {
	createFeatureRuntimeState,
	ensureRuntimeFeaturesInitialized,
	initializeMountedFeature,
	listRuntimeCommands,
	listRuntimeFeatures,
	registerRuntimeCommand,
	registerRuntimeFeature,
	resolveFeatureEnabled,
	resolveFeatureOption,
	resolveMountedFeatureConfig,
	resolveRuntimeFeatureEnv,
} from "@/runtime/features";
import type { Feature } from "@/types";

// Minimal Bash mock – only registerCommand is required by these helpers
function createMockBash() {
	const registered: string[] = [];
	return {
		registered,
		registerCommand(cmd: { name: string }) {
			registered.push(cmd.name);
		},
		getCwd: () => "/home/user",
	} as unknown as import("just-bash").Bash;
}

function createState() {
	const baseFs = new InMemoryFs();
	const fs = new MountableFs({ base: baseFs });
	const bash = createMockBash();
	const bashConfig = resolveBashConfig(undefined);
	const state = createFeatureRuntimeState(baseFs, fs, bashConfig);
	return { state, bash, baseFs, fs };
}

describe("createFeatureRuntimeState", () => {
	it("creates state with empty registries", () => {
		const { state } = createState();
		expect(listRuntimeCommands(state)).toEqual([]);
		expect(listRuntimeFeatures(state)).toEqual([]);
		expect(resolveRuntimeFeatureEnv(state)).toEqual({});
	});
});

describe("registerRuntimeCommand", () => {
	it("adds command to registry and marks it trusted by default", () => {
		const { state, bash } = createState();
		const cmd = { name: "x-test", execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }) };
		registerRuntimeCommand(state, bash, cmd);
		const commands = listRuntimeCommands(state);
		expect(commands.length).toBe(1);
		expect(commands[0].name).toBe("x-test");
		expect(commands[0].trusted).toBe(true);
	});

	it("preserves explicit trusted value on command", () => {
		const { state, bash } = createState();
		const cmd = {
			name: "x-untrusted",
			trusted: false,
			execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
		};
		registerRuntimeCommand(state, bash, cmd);
		expect(listRuntimeCommands(state)[0].trusted).toBe(false);
	});
});

describe("registerRuntimeFeature", () => {
	it("registers feature commands and env keys", () => {
		const { state, bash } = createState();
		const feature: Feature = {
			name: "feat",
			command: [{ name: "x-feat", execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }) }],
			env: { FEAT_VAR: "val" },
		};
		registerRuntimeFeature(state, bash, feature);
		expect(listRuntimeCommands(state).map((c) => c.name)).toContain("x-feat");
		expect(resolveRuntimeFeatureEnv(state)).toEqual({ FEAT_VAR: "val" });
		expect(listRuntimeFeatures(state)[0].name).toBe("feat");
	});

	it("cleans up old commands and env on re-registration with same name", () => {
		const { state, bash } = createState();
		const featureV1: Feature = {
			name: "feat",
			command: [
				{ name: "x-old", execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }) },
				{ name: "x-keep", execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }) },
			],
			env: { OLD_VAR: "old", KEEP_VAR: "keep" },
		};
		registerRuntimeFeature(state, bash, featureV1);

		const featureV2: Feature = {
			name: "feat",
			command: [{ name: "x-keep", execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }) }],
			env: { KEEP_VAR: "keep" },
		};
		registerRuntimeFeature(state, bash, featureV2);

		const cmds = listRuntimeCommands(state).map((c) => c.name);
		expect(cmds).toContain("x-keep");
		expect(cmds).not.toContain("x-old");
		expect(resolveRuntimeFeatureEnv(state)).toEqual({ KEEP_VAR: "keep" });
		expect(resolveRuntimeFeatureEnv(state).OLD_VAR).toBeUndefined();
	});

	it("does not remove commands owned by a different feature", () => {
		const { state, bash } = createState();
		const featA: Feature = {
			name: "feat-a",
			command: [{ name: "x-a", execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }) }],
		};
		const featB: Feature = {
			name: "feat-b",
			command: [{ name: "x-b", execute: async () => ({ stdout: "", stderr: "", exitCode: 0 }) }],
		};
		registerRuntimeFeature(state, bash, featA);
		registerRuntimeFeature(state, bash, featB);
		// Re-register feat-b with different command
		const featBv2: Feature = {
			name: "feat-b",
			command: [],
		};
		registerRuntimeFeature(state, bash, featBv2);

		const cmds = listRuntimeCommands(state).map((c) => c.name);
		expect(cmds).toContain("x-a"); // feat-a command untouched
		expect(cmds).not.toContain("x-b"); // feat-b old command removed
	});
});

describe("ensureRuntimeFeaturesInitialized", () => {
	it("calls feature init exactly once", async () => {
		const { state, bash, baseFs, fs } = createState();
		let initCount = 0;
		const feature: Feature = {
			name: "init-once",
			init: async () => {
				initCount += 1;
			},
		};
		registerRuntimeFeature(state, bash, feature);

		const ctx = () => ({ baseFs, bash, fs });
		await ensureRuntimeFeaturesInitialized(state, ctx);
		await ensureRuntimeFeaturesInitialized(state, ctx);
		expect(initCount).toBe(1);
	});

	it("deduplicates concurrent init calls", async () => {
		const { state, bash, baseFs, fs } = createState();
		let initCount = 0;
		const feature: Feature = {
			name: "concurrent",
			init: async () => {
				initCount += 1;
				// small async gap
				await Promise.resolve();
			},
		};
		registerRuntimeFeature(state, bash, feature);

		const ctx = () => ({ baseFs, bash, fs });
		await Promise.all([
			ensureRuntimeFeaturesInitialized(state, ctx),
			ensureRuntimeFeaturesInitialized(state, ctx),
			ensureRuntimeFeaturesInitialized(state, ctx),
		]);
		expect(initCount).toBe(1);
	});

	it("skips features with no init", async () => {
		const { state, bash, baseFs, fs } = createState();
		const feature: Feature = { name: "no-init" };
		registerRuntimeFeature(state, bash, feature);
		// Should not throw
		await ensureRuntimeFeaturesInitialized(state, () => ({ baseFs, bash, fs }));
	});

	it("propagates init errors to all waiting callers", async () => {
		const { state, bash, baseFs, fs } = createState();
		const feature: Feature = {
			name: "failing",
			init: async () => {
				throw new Error("init error");
			},
		};
		registerRuntimeFeature(state, bash, feature);
		const ctx = () => ({ baseFs, bash, fs });
		await expect(ensureRuntimeFeaturesInitialized(state, ctx)).rejects.toThrow("init error");
	});
});

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
		const baseFs = new InMemoryFs();
		const fs = new MountableFs({ base: baseFs });
		const bash = createMockBash();
		// customFs has a file at its root-level path /file.txt
		const customFs = new InMemoryFs({ "/file.txt": "content" });

		await initializeMountedFeature(
			{ baseFs, fs, bash },
			{ enabled: true, fs: customFs, mountPoint: "/mnt/data" },
			"/mnt/data",
		);
		// After mounting customFs at /mnt/data, /file.txt inside customFs is at /mnt/data/file.txt
		expect(await fs.exists("/mnt/data/file.txt")).toBe(true);
	});

	it("creates directory in baseFs when config.fs is absent", async () => {
		const baseFs = new InMemoryFs();
		const fs = new MountableFs({ base: baseFs });
		const bash = createMockBash();

		await initializeMountedFeature(
			{ baseFs, fs, bash },
			{ enabled: true, mountPoint: "/home/user/memory" },
			"/home/user/memory",
		);
		expect(await baseFs.exists("/home/user/memory")).toBe(true);
	});

	it("does nothing when config.enabled is false", async () => {
		const baseFs = new InMemoryFs();
		const fs = new MountableFs({ base: baseFs });
		const bash = createMockBash();

		await initializeMountedFeature(
			{ baseFs, fs, bash },
			{ enabled: false, mountPoint: "/mnt/data" },
			"/mnt/data",
		);
		expect(await baseFs.exists("/mnt/data")).toBe(false);
	});
});
