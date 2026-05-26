import type { Command } from "just-bash";
import { createInstallSkillCommand } from "@/features/skills/install";
import { createListSkillsCommand } from "@/features/skills/list";
import { createSearchSkillsCommand } from "@/features/skills/search";
import type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
import { createUpdateSkillsCommand } from "@/features/skills/update";
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

export function createSkillsFeature(option: boolean | SkillsOptions | undefined = true): Feature {
	const resolvedOption = resolveFeatureOption(option);
	const config: SkillsConfig = {
		...resolveMountedFeatureConfig(option, DEFAULT_SKILLS_MOUNT),
		cache: resolvedOption?.cache,
		lockfile: resolvedOption?.lockfile ?? true,
	};

	return {
		name: "skills",
		prompt: config.enabled
			? () =>
					`Skills mount: ${config.mountPoint}. Use x-skills to install, list, search, and update mounted skills.`
			: undefined,
		command: config.enabled
			? [
					createSkillsCommand({
						cache: config.cache,
						lockfile: config.lockfile,
						mountPoint: config.mountPoint,
					}),
				]
			: undefined,
		env: config.enabled
			? {
					SKILLS_HOME: config.mountPoint,
				}
			: undefined,
		init: config.enabled
			? async (context) => {
					await initializeMountedFeature(context, config, DEFAULT_SKILLS_MOUNT);
				}
			: undefined,
	};
}

export type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
export { parseSkillInstallTarget } from "@/features/skills/utils/parser";
