import type { ExecResult, IFileSystem } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import { readSkillLockfile } from "@/features/skills/utils/lockfile";
import { frontmatterDescription } from "@/features/skills/utils/metadata";
import { defineCliCommand } from "@/utils/command";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";

export async function listSkills(
	fs: IFileSystem,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	const cacheKey = "skills:list";
	const cached = await options.cache?.get(cacheKey);
	if (cached !== null && cached !== undefined) {
		return { stdout: cached, stderr: "", exitCode: 0 };
	}

	if (!(await fs.exists(options.mountPoint))) {
		return { stdout: "", stderr: "", exitCode: 0 };
	}

	const lockfile = await readSkillLockfile(fs, options.mountPoint);
	const lines: string[] = [];

	for (const entry of await fs.readdir(options.mountPoint)) {
		if (entry === "skills.json") {
			continue;
		}

		const skillPath = fs.resolvePath(options.mountPoint, entry);
		const skillFilePath = fs.resolvePath(skillPath, "SKILL.md");
		if (!(await fs.exists(skillFilePath))) {
			continue;
		}

		const locked = lockfile.skills[entry];
		if (locked) {
			lines.push(`${entry}\t${locked.description}`);
			continue;
		}

		const markdown = await fs.readFile(skillFilePath);
		const { frontmatter } = parseMarkdownFrontmatter(markdown);
		lines.push(`${entry}\t${frontmatterDescription(frontmatter)}`);
	}

	const output = lines.sort().join("\n");
	const stdout = output ? `${output}\n` : "";
	await options.cache?.set(cacheKey, stdout);
	return { stdout, stderr: "", exitCode: 0 };
}

export function createListSkillsCommand(options: SkillsCommandOptions) {
	return defineCliCommand({
		id: "list",
		type: "command",
		summary: "List installed skills.",
		usage: "x-skills list",
		run: (_input, ctx) => listSkills(ctx.fs, options),
	});
}
