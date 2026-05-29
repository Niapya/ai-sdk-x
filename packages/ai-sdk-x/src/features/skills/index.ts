import type { Command, CommandContext, IFileSystem } from "just-bash";
import { createInstallSkillCommand, installSkill } from "@/features/skills/install";
import { createListSkillsCommand, listSkills } from "@/features/skills/list";
import { createSearchSkillsCommand, searchSkills } from "@/features/skills/search";
import type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
import { createUpdateSkillsCommand, updateSkills } from "@/features/skills/update";
import { AsyncOnce } from "@/runtime/async-once";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type { ExecHookStartContext, Feature } from "@/types";
import { type CliTopicDefinition, createCommand } from "@/utils/command";

export const DEFAULT_SKILLS_MOUNT = "/home/user/skills";

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
	const resolvedOption = typeof option === "object" ? option : undefined;
	const config: SkillsConfig = {
		enabled: option !== false,
		fs: resolvedOption?.fs,
		mountPoint: resolvedOption?.mountPoint ?? DEFAULT_SKILLS_MOUNT,
		lockfile: resolvedOption?.lockfile ?? true,
	};
	const commandOptions: SkillsCommandOptions = {
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
		prompt: () =>
			`Skills mount: ${config.mountPoint}. Use x-skills to install, list, search, and update mounted skills.`,
		command: [feature.createCommand()],
		hooks: {
			onExecStart: (context) => initialize.run(context),
		},
	};
}

export type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
export { parseSkillInstallTarget } from "@/features/skills/utils/parser";
