import type { CommandContext, ExecResult } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import { cloneSkillRepository } from "@/features/skills/utils/git";
import { readSkillLockfile, writeSkillLockfile } from "@/features/skills/utils/lockfile";
import { frontmatterDescription } from "@/features/skills/utils/metadata";
import { type CliCommandDefinition, commandError, defineCliCommand } from "@/utils/command";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";

export async function updateSkills(
	ctx: CommandContext,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	const lockfile = await readSkillLockfile(ctx.fs, options.mountPoint);
	const installedSkills = Object.entries(lockfile.skills);
	if (installedSkills.length === 0) {
		return {
			stdout: "No installed skills to update\n",
			stderr: "",
			exitCode: 0,
		};
	}

	const cloneRoots = new Map<string, string>();

	try {
		for (const [, entry] of installedSkills) {
			if (cloneRoots.has(entry.source.repo)) {
				continue;
			}

			const { clonePath, result } = await cloneSkillRepository(entry.source.repo, ctx);
			if (result.exitCode !== 0) {
				return result;
			}

			cloneRoots.set(entry.source.repo, clonePath);
		}

		for (const [selector, entry] of installedSkills) {
			const cloneRoot = cloneRoots.get(entry.source.repo);
			if (!cloneRoot) {
				return commandError(`x-skills update: missing clone for ${entry.source.repo}\n`, 1);
			}

			const sourcePath = ctx.fs.resolvePath(cloneRoot, `skills/${entry.source.selector}`);
			const skillFilePath = ctx.fs.resolvePath(sourcePath, "SKILL.md");
			if (!(await ctx.fs.exists(skillFilePath))) {
				return commandError(
					`x-skills update: missing ${ctx.fs.resolvePath("/skills", `${entry.source.selector}/SKILL.md`)} in ${entry.source.repo}\n`,
					1,
				);
			}

			const markdown = await ctx.fs.readFile(skillFilePath);
			const { frontmatter } = parseMarkdownFrontmatter(markdown);
			const description = frontmatterDescription(frontmatter);
			const destinationPath = ctx.fs.resolvePath(options.mountPoint, selector);

			await ctx.fs.rm(destinationPath, { force: true, recursive: true });
			await ctx.fs.cp(sourcePath, destinationPath, { recursive: true });

			if (options.lockfile) {
				await writeSkillLockfile(
					ctx.fs,
					options,
					{
						repoUrl: entry.source.repo,
						selector: entry.source.selector,
					},
					frontmatter,
					description,
				);
			}
		}

		return {
			stdout: `Updated ${installedSkills.length} skill${installedSkills.length === 1 ? "" : "s"}\n`,
			stderr: "",
			exitCode: 0,
		};
	} finally {
		for (const cloneRoot of cloneRoots.values()) {
			await ctx.fs.rm(cloneRoot, { force: true, recursive: true });
		}
	}
}

export function createUpdateSkillsCommand(
	options: SkillsCommandOptions,
): CliCommandDefinition<undefined, undefined> {
	return defineCliCommand({
		id: "update",
		type: "command",
		summary: "Refresh installed skills from their sources.",
		usage: "x-skills update",
		run: (_args, ctx) => updateSkills(ctx, options),
	});
}
