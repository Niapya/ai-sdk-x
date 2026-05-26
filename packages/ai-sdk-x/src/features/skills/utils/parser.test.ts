import { describe, expect, it } from "bun:test";
import { deriveSkillRepoSlug, parseSkillInstallTarget } from "@/features/skills/utils/parser";

describe("parseSkillInstallTarget", () => {
	it("expands GitHub owner/repo selectors", () => {
		expect(parseSkillInstallTarget("blindmansion/just-git@demo")).toEqual({
			repoUrl: "https://github.com/blindmansion/just-git",
			selector: "demo",
		});
	});

	it("preserves local repository paths", () => {
		expect(parseSkillInstallTarget("/tmp/skills-repo@demo")).toEqual({
			repoUrl: "/tmp/skills-repo",
			selector: "demo",
		});
	});

	it("derives a stable temporary clone slug", () => {
		expect(deriveSkillRepoSlug("https://github.com/blindmansion/just-git")).toBe(
			"blindmansion-just-git",
		);
		expect(deriveSkillRepoSlug("/tmp/skills-repo")).toBe("skills-repo");
	});
});
