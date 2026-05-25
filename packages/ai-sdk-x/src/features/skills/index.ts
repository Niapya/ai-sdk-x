import type { Command } from "just-bash";
import type { FeatureSetupContext, FeatureSetupResult } from "@/features/shared";
import {
	mountConfiguredFeature,
	resolveFeatureOption,
	resolveMountedFeatureConfig,
} from "@/features/shared";
import { createInstallSkillCommand } from "@/features/skills/install";
import { createListSkillsCommand } from "@/features/skills/list";
import { createSearchSkillsCommand } from "@/features/skills/search";
import type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
import { createUpdateSkillsCommand } from "@/features/skills/update";
import { DEFAULT_SKILLS_MOUNT } from "@/runtime/constants";
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
			createUpdateSkillsCommand(),
		],
	});
}

export function setupSkillsFeature(
	context: FeatureSetupContext,
	option: boolean | SkillsOptions | undefined,
): FeatureSetupResult<SkillsConfig> {
	const resolvedOption = resolveFeatureOption(option);
	const config: SkillsConfig = {
		...resolveMountedFeatureConfig(option, DEFAULT_SKILLS_MOUNT),
		cache: resolvedOption?.cache,
		lockfile: resolvedOption?.lockfile ?? true,
	};

	return {
		command: config.enabled
			? createSkillsCommand({
					cache: config.cache,
					lockfile: config.lockfile,
					mountPoint: config.mountPoint,
				})
			: undefined,
		config,
		initPaths: mountConfiguredFeature(context, config, DEFAULT_SKILLS_MOUNT),
		initialize:
			config.enabled && config.lockfile
				? async () => {
						const lockfilePath = `${config.mountPoint}/skills.json`;
						if (!(await context.fs.exists(lockfilePath))) {
							await context.fs.writeFile(
								lockfilePath,
								`${JSON.stringify({ version: 1, skills: {} }, null, 2)}\n`,
							);
						}
					}
				: undefined,
	};
}

export type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
export { parseSkillInstallTarget } from "@/features/skills/utils/parser";
