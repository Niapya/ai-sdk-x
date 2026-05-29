import { describe, expect, it } from "bun:test";
import { type CommandContext, EMPTY_BYTES, InMemoryFs } from "just-bash";
import { createSkillsFeature } from "@/features/skills";

const HOME = "/home/user";

describe("createSkillsFeature", () => {
	it("returns stable helper props when disabled", () => {
		const feature = createSkillsFeature(false);

		expect(feature.name).toBe("skills");
		expect(feature.description).toBeUndefined();
		expect(feature.command).toBeUndefined();
		expect(feature.hooks).toBeUndefined();
		expect(feature.createCommand().name).toBe("x-skills");
		expect(typeof feature.get).toBe("function");
		expect(typeof feature.info).toBe("function");
		expect(typeof feature.install).toBe("function");
		expect(typeof feature.list).toBe("function");
		expect(typeof feature.remove).toBe("function");
		expect(typeof feature.search).toBe("function");
		expect(typeof feature.update).toBe("function");
	});

	it("describes bash usage through x-skills when enabled", async () => {
		const feature = createSkillsFeature(true);
		const fs = new InMemoryFs({
			"/home/user/skills/skills.json":
				'{"version":1,"skills":{"demo":{"createAt":1,"updateAt":1,"files":["$SKILLS_HOME/demo/SKILL.md"],"skillPath":"$SKILLS_HOME/demo/SKILL.md","description":"Demo skill"}}}\n',
		});
		const text = await feature.description?.({ fs } as never);

		expect(text).toContain('command="x-skills list"');
		expect(text).toContain("demo: Demo skill skillPath=$SKILLS_HOME/demo/SKILL.md");
	});

	it("binds list and update helpers to the configured mount point", async () => {
		const fs = new InMemoryFs();
		const feature = createSkillsFeature({
			mountPoint: "/custom-skills",
		});
		const ctx = createContext(fs);

		await fs.mkdir("/custom-skills/demo", { recursive: true });
		await fs.writeFile(
			"/custom-skills/demo/SKILL.md",
			"---\nname: Demo\ndescription: Bound mount\n---\n\n# Demo\n",
		);

		const listResult = await feature.list(fs);
		expect(listResult.exitCode).toBe(0);
		expect(listResult.stdout).toContain("demo\tBound mount\t/custom-skills/demo/SKILL.md");

		await fs.writeFile("/custom-skills/skills.json", '{"version":1,"skills":{}}\n');
		const updateResult = await feature.update(ctx);
		expect(updateResult.exitCode).toBe(0);
		expect(updateResult.stdout).toBe("No installed skills to update\n");
	});
});

function createContext(fs: InMemoryFs): CommandContext {
	return {
		cwd: HOME,
		env: new Map([["HOME", HOME]]),
		fs,
		stdin: EMPTY_BYTES,
	};
}
