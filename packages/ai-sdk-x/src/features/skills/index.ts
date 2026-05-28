import type { Command, CommandContext, IFileSystem } from "just-bash";
import { createInstallSkillCommand, installSkill } from "@/features/skills/install";
import { createListSkillsCommand, listSkills } from "@/features/skills/list";
import { createSearchSkillsCommand, searchSkills } from "@/features/skills/search";
import type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
import { createUpdateSkillsCommand, updateSkills } from "@/features/skills/update";
import { DEFAULT_SKILLS_MOUNT } from "@/runtime/constants";
import {
	initializeMountedFeature,
	resolveFeatureOption,
	resolveMountedFeatureConfig,
} from "@/runtime/features";
import type { Feature } from "@/types";
import { type CliTopicDefinition, createCommand } from "@/utils/command";

const SKILLS_COMMAND = {
	id: "x-skills",
	type: "topic",
	summary: "Manage mounted AI agent skills.",
	usage: "x-skills <list|install|search|update> [args]",
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
			createListSkillsCommand(options),
			createSearchSkillsCommand(),
			createUpdateSkillsCommand(options),
		],
	});
}

export type SkillsFeature = Feature & {
	readonly createCommand: () => Command;
	readonly install: (spec: string, ctx: CommandContext) => ReturnType<typeof installSkill>;
	readonly list: (fs: IFileSystem) => ReturnType<typeof listSkills>;
	readonly search: (query: string) => ReturnType<typeof searchSkills>;
	readonly update: (ctx: CommandContext) => ReturnType<typeof updateSkills>;
};

export function createSkillsFeature(
	option: boolean | SkillsOptions | undefined = true,
): SkillsFeature {
	const resolvedOption = resolveFeatureOption(option);
	const config: SkillsConfig = {
		...resolveMountedFeatureConfig(option, DEFAULT_SKILLS_MOUNT),
		cache: resolvedOption?.cache,
		lockfile: resolvedOption?.lockfile ?? true,
	};
	const commandOptions: SkillsCommandOptions = {
		cache: config.cache,
		lockfile: config.lockfile,
		mountPoint: config.mountPoint,
	};
	const feature: SkillsFeature = {
		name: "skills",
		createCommand: () => createSkillsCommand(commandOptions),
		install: (spec, ctx) => installSkill(spec, ctx, commandOptions),
		list: (fs) => listSkills(fs, commandOptions),
		search: (query) => searchSkills(query),
		update: (ctx) => updateSkills(ctx, commandOptions),
	};

	if (!config.enabled) {
		return feature;
	}

	return {
		...feature,
		prompt: () =>
			`Skills mount: ${config.mountPoint}. Use x-skills to install, list, search, and update mounted skills.`,
		command: [feature.createCommand()],
		hooks: {
			initialize: async (context) => {
				await initializeMountedFeature(context, config, DEFAULT_SKILLS_MOUNT);
				context.setEnv("SKILLS_HOME", config.mountPoint);
			},
		},
	};
}

export type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
export { parseSkillInstallTarget } from "@/features/skills/utils/parser";
