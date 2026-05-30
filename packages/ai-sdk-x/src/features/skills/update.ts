import type { CommandContext, ExecResult } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import { cloneSkillRepository } from "@/features/skills/utils/git";
import {
	collectSkillFiles,
	findSkillMarkdownFile,
	readSkillsIndex,
	writeSkillIndexEntry,
} from "@/features/skills/utils/lockfile";
import { frontmatterDescription, stringifyFrontmatter } from "@/features/skills/utils/metadata";
import { type CliCommandDefinition, commandError, defineCliCommand } from "@/utils/command";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";

export async function updateSkills(
	ctx: CommandContext,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	const index = await readSkillsIndex(ctx.fs, options.mountPoint);
	const installedSkills = Object.entries(index.skills).filter(([, entry]) => entry.url);
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
			if (!entry.url || cloneRoots.has(entry.url)) {
				continue;
			}

			const { clonePath, result } = await cloneSkillRepository(entry.url, ctx);
			if (result.exitCode !== 0) {
				return result;
			}

			cloneRoots.set(entry.url, clonePath);
		}

		for (const [selector, entry] of installedSkills) {
			if (!entry.url) {
				continue;
			}

			const cloneRoot = cloneRoots.get(entry.url);
			if (!cloneRoot) {
				return commandError(`x-skills update: missing clone for ${entry.url}\n`, 1);
			}

			const sourcePath = ctx.fs.resolvePath(cloneRoot, `skills/${selector}`);
			const sourceSkillFilePath = await findSkillMarkdownFile(ctx.fs, sourcePath);
			if (!sourceSkillFilePath) {
				return commandError(
					`x-skills update: missing /skills/${selector}/SKILLS.md in ${entry.url}\n`,
					1,
				);
			}

			const markdown = await ctx.fs.readFile(sourceSkillFilePath);
			const { frontmatter } = parseMarkdownFrontmatter(markdown);
			const description = frontmatterDescription(frontmatter);
			const destinationPath = ctx.fs.resolvePath(options.mountPoint, selector);

			await ctx.fs.rm(destinationPath, { force: true, recursive: true });
			await ctx.fs.cp(sourcePath, destinationPath, { recursive: true });

			const skillPath = ctx.fs.resolvePath(
				destinationPath,
				sourceSkillFilePath.slice(sourcePath.length).replace(/^\/+/, ""),
			);
			if (options.lockfile) {
				await writeSkillIndexEntry(ctx.fs, options, {
					description,
					files: await collectSkillFiles(ctx.fs, destinationPath),
					frontmatter: stringifyFrontmatter(frontmatter),
					skillPath,
					source: "git",
					target: {
						repoUrl: entry.url,
						selector,
					},
				});
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
