import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("X feature setup", () => {
	it("exports enabled feature mounts as shell environment variables", async () => {
		const x = new X({
			memory: { mountPoint: "/mem" },
			skills: { mountPoint: "/skills-dir" },
			workspace: { mountPoint: "/workspace-dir" },
		});

		const result = await x.exec(
			'printf "%s|%s|%s" "$WORKSPACE_HOME" "$SKILLS_HOME" "$MEMORY_HOME"',
		);

		expect(result.stdout).toBe("/workspace-dir|/skills-dir|/mem");
	});

	it("omits feature home environment variables when features are disabled", async () => {
		const x = new X({
			memory: false,
			skills: false,
			workspace: false,
		});

		const result = await x.exec(
			'printf "%s|%s|%s" "$WORKSPACE_HOME" "$SKILLS_HOME" "$MEMORY_HOME"',
		);

		expect(result.stdout).toBe("||");
	});

	it("skips disabled feature commands and mounts", async () => {
		const x = new X({
			memory: false,
			patch: false,
			skills: false,
			workspace: false,
		});

		expect("memory" in x.commands).toBe(false);
		expect("patch" in x.commands).toBe(false);
		expect("skills" in x.commands).toBe(false);
		expect(await x.fs.exists("/home/user/memory")).toBe(false);
		expect(await x.fs.exists("/home/user/skills")).toBe(false);
		expect(await x.fs.exists("/home/user/workspace")).toBe(false);

		const memoryResult = await x.exec("x-memory list");
		const skillsResult = await x.exec("x-skills list");
		const patchResult = await x.exec("x-patch --help");

		expect(memoryResult.stderr.includes("command not found")).toBe(true);
		expect(skillsResult.stderr.includes("command not found")).toBe(true);
		expect(patchResult.stderr.includes("command not found")).toBe(true);
	});

	it("registers built-in feature commands by default", () => {
		const x = new X();

		expect("memory" in x.commands).toBe(true);
		expect("patch" in x.commands).toBe(true);
		expect("skills" in x.commands).toBe(true);
	});
});
