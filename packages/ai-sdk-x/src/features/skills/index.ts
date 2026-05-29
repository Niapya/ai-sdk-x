import type { Command, CommandContext, IFileSystem } from "just-bash";
import { createGetSkillCommand, getSkill } from "@/features/skills/get";
import { createInfoSkillCommand, infoSkill } from "@/features/skills/info";
import { createInstallSkillCommand, installSkill } from "@/features/skills/install";
import { createListSkillsCommand, listSkills } from "@/features/skills/list";
import { createRemoveSkillCommand, removeSkill } from "@/features/skills/remove";
import { createSearchSkillsCommand, searchSkills } from "@/features/skills/search";
import type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
import { createUpdateSkillsCommand, updateSkills } from "@/features/skills/update";
import { readSkillsIndex } from "@/features/skills/utils/lockfile";
import { AsyncOnce } from "@/runtime/async-once";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type { ExecHookStartContext, Feature, FeatureSetupContext } from "@/types";
import { type CliTopicDefinition, createCommand } from "@/utils/command";

export const DEFAULT_SKILLS_MOUNT = "/home/user/skills";

export async function createSkillsFeatureDescription(
	ctx: FeatureSetupContext,
	mountPoint: string,
): Promise<string> {
	const index = await readSkillsIndex(ctx.fs, mountPoint);
	const installed = Object.entries(index.skills)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(
			([skillName, entry]) =>
				`${skillName}: ${entry.description || "No description."} skillPath=${entry.skillPath}`,
		);
	const installedText =
		installed.length > 0 ? `Installed skills:\n${installed.join("\n")}` : "Installed skills: none.";

	return [
		`The skills feature provides mounted AI agent skills at ${mountPoint}.`,
		'Use `x-skills` command through the bash tool. Put the shell command in command, for example command="x-skills list" or command="x-skills install https://github.com/vercel-labs/agent-skills@vercel-composition-patterns".',
		"Run x-skills --help or x-skills <subcommand> --help when unsure.",
		"Skill files can be read directly from this mount, and JavaScript or TypeScript helper code may import local skill files when appropriate; prefer .mjs or .mts modules for js-exec.",
		"`x-skills install`, `x-skills list`, and `x-skills search` return skillPath information when available; use skillPath to inspect the installed skill file.",
		installedText,
	].join("\n");
}

const SKILLS_COMMAND = {
	id: "x-skills",
	type: "topic",
	summary: "Manage mounted AI agent skills.",
	usage: "x-skills <install|update|list|remove|search|get|info> [args]",
	description: [
		"Install and list skills stored under the mounted skills directory.",
		"Install expects <repo-url>@<skill-name> and copies /skills/<skill-name> from the cloned repository.",
	],
	examples: [
		{ command: "x-skills list" },
		{
			command:
				"x-skills install https://github.com/vercel-labs/agent-skills@vercel-composition-patterns",
		},
	],
	hidden: false,
} satisfies Omit<CliTopicDefinition, "subcommands">;

export function createSkillsCommand(options: SkillsCommandOptions): Command {
	return createCommand({
		...SKILLS_COMMAND,
		subcommands: [
			createInstallSkillCommand(options),
			createUpdateSkillsCommand(options),
			createListSkillsCommand(options),
			createRemoveSkillCommand(options),
			createSearchSkillsCommand(),
			createGetSkillCommand(options),
			createInfoSkillCommand(options),
		],
	});
}

export type SkillsFeature = Feature & {
	readonly createCommand: () => Command;
	readonly get: (skillName: string, fs: IFileSystem) => ReturnType<typeof getSkill>;
	readonly info: (skillName: string, fs: IFileSystem) => ReturnType<typeof infoSkill>;
	readonly install: (spec: string, ctx: CommandContext) => ReturnType<typeof installSkill>;
	readonly list: (fs: IFileSystem) => ReturnType<typeof listSkills>;
	readonly remove: (
		input: Parameters<typeof removeSkill>[0],
		ctx: CommandContext,
	) => ReturnType<typeof removeSkill>;
	readonly search: (query: string) => ReturnType<typeof searchSkills>;
	readonly update: (ctx: CommandContext) => ReturnType<typeof updateSkills>;
};

export function createSkillsFeature(
	option: boolean | SkillsOptions | undefined = true,
): SkillsFeature {
	const resolvedOption = typeof option === "object" ? option : undefined;
	const config: SkillsConfig = {
		enabled: option !== false,
		fs: resolvedOption?.fs,
		lockfile: resolvedOption?.lockfile ?? true,
		mountPoint: resolvedOption?.mountPoint ?? DEFAULT_SKILLS_MOUNT,
	};
	const commandOptions: SkillsCommandOptions = {
		lockfile: config.lockfile,
		mountPoint: config.mountPoint,
	};
	const feature: SkillsFeature = {
		name: "skills",
		createCommand: () => createSkillsCommand(commandOptions),
		get: (skillName, fs) => getSkill(skillName, fs, commandOptions),
		info: (skillName, fs) => infoSkill(skillName, fs, commandOptions),
		install: (spec, ctx) => installSkill(spec, ctx, commandOptions),
		list: (fs) => listSkills(fs, commandOptions),
		remove: (input, ctx) => removeSkill(input, ctx, commandOptions),
		search: (query) => searchSkills(query),
		update: (ctx) => updateSkills(ctx, commandOptions),
	};

	if (!config.enabled) {
		return feature;
	}

	const initialize = new AsyncOnce<[ExecHookStartContext]>(async (context) => {
		if (config.fs) {
			context.fs.mount(config.mountPoint, config.fs);
		} else {
			if (config.mountPoint !== DEFAULT_SKILLS_MOUNT) {
				context.fs.mount(config.mountPoint, createSubpathFs(context.fs, DEFAULT_SKILLS_MOUNT));
			}

			await context.fs.mkdir(DEFAULT_SKILLS_MOUNT, { recursive: true });
		}

		context.setEnv("SKILLS_HOME", config.mountPoint);
	});

	return {
		...feature,
		description: (ctx) => createSkillsFeatureDescription(ctx, config.mountPoint),
		command: [feature.createCommand()],
		hooks: {
			onExecStart: (context) => initialize.run(context),
		},
	};
}

export type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
export { parseSkillInstallTarget } from "@/features/skills/utils/parser";
