import type { CommandContext, ExecResult } from "just-bash";
import type { SkillIndexEntry, SkillsCommandOptions } from "@/features/skills/types";
import {
	discoverSkills,
	relativePathFromRoot,
	selectDiscoveredSkill,
} from "@/features/skills/utils/discover";
import { cloneSkillRepository } from "@/features/skills/utils/git";
import {
	collectSkillFiles,
	readSkillsIndex,
	writeSkillIndexEntry,
} from "@/features/skills/utils/lockfile";
import { stringifyFrontmatter } from "@/features/skills/utils/metadata";
import { commandError, defineCliCommand } from "@/utils/command";

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

			const selected = await findUpdateSkill(ctx, cloneRoot, selector, entry);
			if ("error" in selected) {
				return commandError(`x-skills update: ${selected.error} in ${entry.url}\n`, 1);
			}

			const destinationPath = ctx.fs.resolvePath(options.mountPoint, selector);
			await ctx.fs.rm(destinationPath, { force: true, recursive: true });
			await ctx.fs.cp(selected.path, destinationPath, { recursive: true });

			const skillPath = ctx.fs.resolvePath(
				destinationPath,
				selected.skillFilePath.slice(selected.path.length).replace(/^\/+/, ""),
			);
			const files = await collectSkillFiles(ctx.fs, destinationPath);
			const sourcePath = relativePathFromRoot(ctx.fs, cloneRoot, selected.path);

			if (options.lockfile) {
				await writeSkillIndexEntry(ctx.fs, options, {
					description: selected.description,
					files,
					frontmatter: stringifyFrontmatter(selected.frontmatter),
					skillPath,
					source: "git",
					sourcePath,
					target: {
						repoUrl: entry.url,
						selector,
						sourcePath,
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

async function findUpdateSkill(
	ctx: CommandContext,
	cloneRoot: string,
	selector: string,
	entry: SkillIndexEntry,
) {
	if (entry.sourcePath) {
		const sourcePath = ctx.fs.resolvePath(cloneRoot, entry.sourcePath);
		const sourcePathSkills = await discoverSkills(ctx.fs, sourcePath);
		const selected = selectDiscoveredSkill(sourcePathSkills, undefined);
		if (!("error" in selected)) {
			return selected;
		}
	}

	const legacyPath = ctx.fs.resolvePath(cloneRoot, `skills/${selector}`);
	const legacySkills = await discoverSkills(ctx.fs, legacyPath);
	const legacySelected = selectDiscoveredSkill(legacySkills, undefined);
	if (!("error" in legacySelected)) {
		return legacySelected;
	}

	const discovered = await discoverSkills(ctx.fs, cloneRoot);
	return selectDiscoveredSkill(discovered, selector);
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
