import type { CommandContext, ExecResult } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import { removeSkillIndexEntry } from "@/features/skills/utils/lockfile";
import { commandError, defineCliCommand } from "@/utils/command";

export interface RemoveSkillInput {
	force: boolean;
	skillName: string;
}

export async function removeSkill(
	input: RemoveSkillInput,
	ctx: CommandContext,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	const skillName = input.skillName.trim();
	if (!skillName) {
		return commandError("x-skills remove: missing <skillName>\n", 1);
	}
	if (!input.force) {
		return commandError("x-skills remove: pass -y to remove without confirmation\n", 1);
	}

	const skillDir = ctx.fs.resolvePath(options.mountPoint, skillName);
	const skillDirExists = await ctx.fs.exists(skillDir);
	await ctx.fs.rm(skillDir, { force: true, recursive: true });
	const removedFromIndex = options.lockfile
		? await removeSkillIndexEntry(ctx.fs, options.mountPoint, skillName)
		: false;

	if (!removedFromIndex && !skillDirExists) {
		return commandError(`x-skills remove: skill not found: ${skillName}\n`, 1);
	}

	return {
		stdout: `Removed ${skillName}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createRemoveSkillCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "remove",
		type: "command",
		summary: "Remove an installed skill.",
		usage: "x-skills remove -y <skillName>",
		args: [
			{
				name: "skillName",
				required: true,
				summary: "Installed skill name.",
			},
		],
		flags: {
			y: {
				char: "y",
				description: "Remove without prompting.",
				type: "boolean",
			},
		},
		run: ({ args: { skillName }, flags: { y = false } }, ctx) =>
			removeSkill({ force: y, skillName }, ctx, options),
	});
}
