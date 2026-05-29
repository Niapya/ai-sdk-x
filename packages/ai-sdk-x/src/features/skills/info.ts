import type { ExecResult, IFileSystem } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import { readSkillsIndex } from "@/features/skills/utils/lockfile";
import { commandError, defineCliCommand } from "@/utils/command";

export async function infoSkill(
	skillName: string,
	fs: IFileSystem,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	const normalizedName = skillName.trim();
	if (!normalizedName) {
		return commandError("x-skills info: missing <skillName>\n", 1);
	}

	const index = await readSkillsIndex(fs, options.mountPoint);
	const entry = index.skills[normalizedName];
	if (!entry) {
		return commandError(`x-skills info: skill not found: ${normalizedName}\n`, 1);
	}

	return {
		stdout: `${JSON.stringify({ skillName: normalizedName, ...entry }, null, 2)}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createInfoSkillCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "info",
		type: "command",
		summary: "Show indexed metadata for an installed skill.",
		usage: "x-skills info <skillName>",
		args: [
			{
				name: "skillName",
				required: true,
				summary: "Installed skill name.",
			},
		],
		run: ({ args: { skillName } }, ctx) => infoSkill(skillName, ctx.fs, options),
	});
}
