import { describe, expect, it } from "bun:test";
import {
	deriveSkillRepoSlug,
	normalizeSkillSource,
	parseSkillInstallSpec,
	parseSkillInstallTarget,
} from "@/features/skills/utils/parser";

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

	it("parses source without a selector", () => {
		expect(parseSkillInstallSpec("./local-skill")).toEqual({ source: "./local-skill" });
	});

	it("parses GitHub tree and blob URLs into clone URL and preferred path", () => {
		expect(
			normalizeSkillSource("https://github.com/owner/repo/tree/main/.codex/skills/demo"),
		).toMatchObject({
			cloneUrl: "https://github.com/owner/repo",
			preferredPath: ".codex/skills/demo",
			type: "github",
		});

		expect(
			normalizeSkillSource("https://gitlab.com/group/project/blob/main/skills/demo/SKILL.md"),
		).toMatchObject({
			cloneUrl: "https://gitlab.com/group/project",
			preferredPath: "skills/demo",
			type: "gitlab",
		});
	});

	it("keeps selector compatibility for GitHub tree URLs", () => {
		expect(
			parseSkillInstallTarget("https://github.com/owner/repo/tree/main/.codex/skills/demo@demo"),
		).toEqual({
			repoUrl: "https://github.com/owner/repo",
			selector: "demo",
			sourcePath: ".codex/skills/demo",
		});
	});
});
