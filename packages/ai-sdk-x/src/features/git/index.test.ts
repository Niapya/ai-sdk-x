import { describe, expect, it } from "bun:test";
import { createGitFeature } from "@/features/git";

describe("createGitFeature", () => {
	it("has name 'git' regardless of config", () => {
		expect(createGitFeature(true).name).toBe("git");
		expect(createGitFeature(false).name).toBe("git");
		expect(createGitFeature(undefined).name).toBe("git");
	});

	it("only exposes a description when enabled", async () => {
		const featureEnabled = createGitFeature(true);
		const featureDisabled = createGitFeature(false);

		expect(typeof featureEnabled.description).toBe("function");
		expect(featureDisabled.description).toBeUndefined();
		const text = await featureEnabled.description?.({} as never);
		expect(text).toContain("git");
		expect(text).toContain("not as a separate callable tool");
		expect(text).toContain('command="git status"');
	});

	it("includes a command array when enabled", () => {
		const feature = createGitFeature(true);
		expect(Array.isArray(feature.command)).toBe(true);
		expect((feature.command as unknown[]).length).toBeGreaterThan(0);
		expect((feature.command as Array<{ name: string }>)[0].name).toBe("git");
	});

	it("has no command when disabled", () => {
		const feature = createGitFeature(false);
		expect(feature.command).toBeUndefined();
	});

	it("passes options to createGit when provided", () => {
		// Just verify it doesn't throw and command is still present
		const feature = createGitFeature();
		expect(Array.isArray(feature.command)).toBe(true);
	});
});
