import type { ExecResult, IFileSystem } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import {
	listSkillCatalog,
	renderFileList,
	renderFrontmatter,
} from "@/features/skills/utils/output";
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

	const entry = (await listSkillCatalog(fs, options)).find(
		(skill) => skill.title === normalizedName,
	);
	if (!entry) {
		return commandError(`x-skills info: skill not found: ${normalizedName}\n`, 1);
	}

	return {
		stdout: `${[
			`Title: ${entry.title}`,
			`Description: ${entry.description}`,
			`File Path: ${entry.skillFilePath}`,
			`Source: ${entry.source}`,
			"Files:",
			renderFileList(entry.files),
			"Front Matter:",
			renderFrontmatter(entry.frontmatter),
		].join("\n")}\n`,
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
		summary: "Show indexed metadata and frontmatter for an installed skill.",
		usage: "x-skills info <skillName>",
		args: [
			{
				name: "skillName",
				required: true,
				summary: "Installed skill directory name.",
			},
		],
		run: ({ args: { skillName } }, ctx) => infoSkill(skillName, ctx.fs, options),
	});
}
