import type { CommandContext, ExecResult } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import { cloneSkillRepository } from "@/features/skills/utils/git";
import { writeSkillLockfile } from "@/features/skills/utils/lockfile";
import { frontmatterDescription } from "@/features/skills/utils/metadata";
import { parseSkillInstallTarget } from "@/features/skills/utils/parser";
import { commandError, defineCliCommand } from "@/utils/command";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";

export async function installSkill(
	spec: string,
	ctx: CommandContext,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	if (!spec) {
		return commandError("x-skills install: missing <repo>@<skill-name>\n", 1);
	}

	const target = parseSkillInstallTarget(spec);
	if (!target) {
		return commandError(
			"x-skills install: expected <repo>@<skill-name>; installing an entire repository is not supported\n",
			1,
		);
	}

	const { clonePath, result: clone } = await cloneSkillRepository(target.repoUrl, ctx);
	if (clone.exitCode !== 0) {
		return clone;
	}

	const cloneRoot = clonePath;
	const sourcePath = ctx.fs.resolvePath(cloneRoot, `skills/${target.selector}`);
	const skillFilePath = ctx.fs.resolvePath(sourcePath, "SKILL.md");
	const destinationPath = ctx.fs.resolvePath(options.mountPoint, target.selector);

	try {
		if (!(await ctx.fs.exists(skillFilePath))) {
			return commandError(
				`x-skills install: missing ${ctx.fs.resolvePath("/skills", `${target.selector}/SKILL.md`)} in ${target.repoUrl}\n`,
				1,
			);
		}

		const markdown = await ctx.fs.readFile(skillFilePath);
		const { frontmatter } = parseMarkdownFrontmatter(markdown);
		const description = frontmatterDescription(frontmatter);

		await ctx.fs.rm(destinationPath, { force: true, recursive: true });
		await ctx.fs.cp(sourcePath, destinationPath, { recursive: true });

		if (options.lockfile) {
			await writeSkillLockfile(ctx.fs, options, target, frontmatter, description);
		}

		await options.cache?.delete("skills:list");

		return {
			stdout: `Installed ${target.selector} from ${target.repoUrl}\n`,
			stderr: "",
			exitCode: 0,
		};
	} finally {
		await ctx.fs.rm(cloneRoot, { force: true, recursive: true });
	}
}

export function createInstallSkillCommand(options: SkillsCommandOptions) {
	return defineCliCommand({
		id: "install",
		type: "command",
		summary: "Install a skill from a repository selector.",
		usage: "x-skills install <repo@skill-name>",
		args: [
			{
				name: "spec",
				required: true,
				summary: "Repository selector with the skill selector suffix.",
			},
		],
		examples: [
			{
				command: "x-skills install vercel-labs/agent-skills@vercel-composition-patterns",
			},
		],
		run: ({ args: { spec } }, ctx) => installSkill(spec, ctx, options),
	});
}
