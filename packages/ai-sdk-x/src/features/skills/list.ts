import type { ExecResult, IFileSystem } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import { findSkillMarkdownFile, readSkillsIndex } from "@/features/skills/utils/lockfile";
import { frontmatterDescription } from "@/features/skills/utils/metadata";
import { defineCliCommand } from "@/utils/command";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";

export async function listSkills(
	fs: IFileSystem,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	if (!(await fs.exists(options.mountPoint))) {
		return { stdout: "", stderr: "", exitCode: 0 };
	}

	const index = await readSkillsIndex(fs, options.mountPoint);
	const lines: string[] = [];

	for (const [skillName, entry] of Object.entries(index.skills)) {
		lines.push(`${skillName}\t${entry.description ?? ""}`);
	}

	if (lines.length > 0) {
		const output = lines.sort().join("\n");
		return { stdout: `${output}\n`, stderr: "", exitCode: 0 };
	}

	for (const entry of await fs.readdir(options.mountPoint)) {
		if (entry === "skills.json") {
			continue;
		}

		const skillPath = fs.resolvePath(options.mountPoint, entry);
		const skillFilePath = await findSkillMarkdownFile(fs, skillPath);
		if (!skillFilePath) {
			continue;
		}

		const markdown = await fs.readFile(skillFilePath);
		const { frontmatter } = parseMarkdownFrontmatter(markdown);
		lines.push(`${entry}\t${frontmatterDescription(frontmatter)}`);
	}

	const output = lines.sort().join("\n");
	const stdout = output ? `${output}\n` : "";
	return { stdout, stderr: "", exitCode: 0 };
}

export function createListSkillsCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "list",
		type: "command",
		summary: "List installed skills.",
		usage: "x-skills list",
		run: (_input, ctx) => listSkills(ctx.fs, options),
	});
}
