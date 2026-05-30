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
import { commandError, defineCliCommand } from "@/utils/command";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";

export async function updateSkills(
	ctx: CommandContext,
	options: SkillsCommandOptions,
	skillName?: string,
): Promise<ExecResult> {
	const requestedSkillName = skillName?.trim();
	const index = await readSkillsIndex(ctx.fs, options.mountPoint);
	const installedSkills = Object.entries(index.skills).filter(([selector, entry]) => {
		if (!entry.url) {
			return false;
		}
		return requestedSkillName ? selector === requestedSkillName : true;
	});

	if (requestedSkillName && installedSkills.length === 0) {
		return commandError(
			`x-skills update: skill not found or not installed from git: ${requestedSkillName}\n`,
			1,
		);
	}

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
				return commandError(
					`x-skills update: failed to clone ${entry.url}\n${withTrailingNewline(result.stderr || result.stdout || "git clone failed without output")}`,
					result.exitCode,
				);
			}

			cloneRoots.set(entry.url, clonePath);
		}

		const updatedSkills: string[] = [];
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
					`x-skills update: missing /skills/${selector}/SKILL.md or /skills/${selector}/SKILLS.md in ${entry.url}\n`,
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

			updatedSkills.push(selector);
		}

		return {
			stdout: `${[
				...updatedSkills.map((selector) => `Update \`${selector}\` successfully.`),
				`Total updated skills: ${updatedSkills.length}`,
			].join("\n")}\n`,
			stderr: "",
			exitCode: 0,
		};
	} finally {
		for (const cloneRoot of cloneRoots.values()) {
			await ctx.fs.rm(cloneRoot, { force: true, recursive: true });
		}
	}
}

function withTrailingNewline(value: string): string {
	return value.endsWith("\n") ? value : `${value}\n`;
}

export function createUpdateSkillsCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "update",
		type: "command",
		summary: "Refresh installed skills from their sources.",
		usage: "x-skills update [skillName]",
		args: [
			{
				name: "skillName",
				summary: "Optional installed skill directory name.",
			},
		],
		run: ({ args: { skillName } }, ctx) => updateSkills(ctx, options, skillName),
	});
}
