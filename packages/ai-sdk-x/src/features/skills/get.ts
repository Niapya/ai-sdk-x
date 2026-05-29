import type { ExecResult, IFileSystem } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import {
	findSkillMarkdownFile,
	readSkillsIndex,
	resolveSkillsHomePath,
} from "@/features/skills/utils/lockfile";
import { commandError, defineCliCommand } from "@/utils/command";

export async function getSkill(
	skillName: string,
	fs: IFileSystem,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	const normalizedName = skillName.trim();
	if (!normalizedName) {
		return commandError("x-skills get: missing <skillName>\n", 1);
	}

	const index = await readSkillsIndex(fs, options.mountPoint);
	const indexedPath = index.skills[normalizedName]?.skillPath;
	const skillPath =
		(indexedPath ? resolveSkillsHomePath(fs, options.mountPoint, indexedPath) : undefined) ??
		(await findSkillMarkdownFile(fs, fs.resolvePath(options.mountPoint, normalizedName)));

	if (!skillPath || !(await fs.exists(skillPath))) {
		return commandError(`x-skills get: skill not found: ${normalizedName}\n`, 1);
	}

	return {
		stdout: await fs.readFile(skillPath),
		stderr: "",
		exitCode: 0,
	};
}

export function createGetSkillCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "get",
		type: "command",
		summary: "Print an installed skill markdown file.",
		usage: "x-skills get <skillName>",
		args: [
			{
				name: "skillName",
				required: true,
				summary: "Installed skill name.",
			},
		],
		run: ({ args: { skillName } }, ctx) => getSkill(skillName, ctx.fs, options),
	});
}
