import type { CommandContext, ExecResult } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import { cloneSkillRepository } from "@/features/skills/utils/git";
import {
	collectSkillFiles,
	findSkillMarkdownFile,
	toSkillsHomePath,
	writeSkillIndexEntry,
} from "@/features/skills/utils/lockfile";
import { frontmatterDescription, stringifyFrontmatter } from "@/features/skills/utils/metadata";
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
	const destinationPath = ctx.fs.resolvePath(options.mountPoint, target.selector);

	try {
		const sourceSkillFilePath = await findSkillMarkdownFile(ctx.fs, sourcePath);
		if (!sourceSkillFilePath) {
			return commandError(
				`x-skills install: missing /skills/${target.selector}/SKILLS.md in ${target.repoUrl}\n`,
				1,
			);
		}

		const markdown = await ctx.fs.readFile(sourceSkillFilePath);
		const { frontmatter } = parseMarkdownFrontmatter(markdown);
		const description = frontmatterDescription(frontmatter);

		await ctx.fs.rm(destinationPath, { force: true, recursive: true });
		await ctx.fs.cp(sourcePath, destinationPath, { recursive: true });

		const skillPath = ctx.fs.resolvePath(
			destinationPath,
			sourceSkillFilePath.slice(sourcePath.length).replace(/^\/+/, ""),
		);
		const files = await collectSkillFiles(ctx.fs, destinationPath);
		if (options.lockfile) {
			await writeSkillIndexEntry(ctx.fs, options, {
				description,
				files,
				frontmatter: stringifyFrontmatter(frontmatter),
				skillPath,
				source: "git",
				target,
			});
		}

		const outputSkillPath = options.lockfile
			? toSkillsHomePath(ctx.fs, options.mountPoint, skillPath)
			: skillPath;
		return {
			stdout: `
installed\t${target.selector}
description\t${description}
source\t${target.repoUrl}
skillPath\t${outputSkillPath}
files\t${files.length}
`,
			stderr: "",
			exitCode: 0,
		};
	} finally {
		await ctx.fs.rm(cloneRoot, { force: true, recursive: true });
	}
}

export function createInstallSkillCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
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
				command: "x-skills install intellectronica/agent-skills@context7",
			},
		],
		run: ({ args: { spec } }, ctx) => installSkill(spec, ctx, options),
	});
}
