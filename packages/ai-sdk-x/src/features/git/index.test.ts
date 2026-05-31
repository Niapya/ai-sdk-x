import { describe, expect, it } from "bun:test";
import { createGitFeature, createGitFeatureDescription } from "@/features/git";
import X from "@/index";

describe("createGitFeature", () => {
	it("returns a disabled bare feature when option is false", () => {
		const feature = createGitFeature(false);

		expect(feature.name).toBe("git");
		expect(feature.command).toBeUndefined();
		expect(feature.description).toBeUndefined();
	});

	it("registers a just-git backed command that works through bash", async () => {
		const x = X.init({ memory: false, patch: false, skills: false, workspace: false });

		const result = await x.exec("git --version");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("git version");
	});

	it("describes git as a bash-only command with safety guidance", () => {
		const description = createGitFeatureDescription();

		expect(description).toContain("Git");
	});
});
