import type { Command, CommandContext, IFileSystem } from "just-bash";
import { type AddSkillInput, addSkill, createAddSkillCommand } from "@/features/skills/add";
import { createFindSkillsCommand, findSkills } from "@/features/skills/find";
import { createImportSkillCommand, importSkill } from "@/features/skills/import";
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
import type {
	ExecHookStartContext,
	Feature,
	FeatureInstructions,
	FeatureSetupContext,
} from "@/types";
import { type CliTopicDefinition, createCommand } from "@/utils/command";

export const DEFAULT_SKILLS_MOUNT = "/home/user/skills";
const MAX_SKILL_DESCRIPTION_LENGTH = 200;

function truncateSkillDescription(description: string | undefined): string {
	const text = (description || "No description.").trim().replace(/\s+/g, " ");
	if (text.length <= MAX_SKILL_DESCRIPTION_LENGTH) {
		return text;
	}

	return `${text.slice(0, MAX_SKILL_DESCRIPTION_LENGTH - 3)}...`;
}

export async function createSkillsFeatureDescription(
	ctx: FeatureSetupContext,
	mountPoint: string,
): Promise<FeatureInstructions> {
	const index = await readSkillsIndex(ctx.fs, mountPoint);
	const installed = Object.entries(index.skills)
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([skillName, entry]) =>
			[
				"<skill>",
				`<title>${skillName}</title>`,
				`<description>${truncateSkillDescription(entry.description)}</description>`,
				`<file>${entry.skillPath}</file>`,
				"</skill>",
			].join("\n"),
		);
	const installedText =
		installed.length > 0
			? `<available_skills>\n${installed.join("\n")}\n</available_skills>`
			: "<available_skills>none</available_skills>";

	return {
		guidance: [
			"Skills provide specialized capabilities, domain knowledge, and refined workflows for producing high-quality outputs. Each skill folder contains tested instructions for specific domains like testing strategies, API design, or performance optimization. Multiple skills can be combined when a task spans different domains.",
			"When a skill applies to the user's request, you MUST load and read the SKILL.md file IMMEDIATELY as your first action, BEFORE generating any other response or taking action on the task.",
			"NEVER just mention or reference a skill in your response without actually loading it first. If a skill is relevant, load it before proceeding.",
			"How to determine if a skill applies:",
			"1. Review the available skills below and match their descriptions against the user's request",
			"2. If any skill's domain overlaps with the task, load that skill immediately",
			"3. When multiple skills apply (e.g., a flowchart in documentation), load all relevant skills",
			"`x-skills` commands are Bash commands.",
			"Use `x-skills find` for installed/local skills and `x-skills search` for internet skill discovery. Install external skills from Git repositories with `x-skills install`. Add local skills with `x-skills add --stdin`, `x-skills add --file <path>`, or `x-skills import <directory>`. `x-skills list` and `x-skills find` expose skill paths; inspect those files when a skill is relevant.",
			"Do not write directly into `$SKILLS_HOME` to add skills because the lockfile and metadata would be unmanaged.",
		].join("\n"),
		environment: [`Mounted skills directory($SKILLS_HOME): ${mountPoint}.`, installedText].join(
			"\n",
		),
	};
}

const SKILLS_COMMAND = {
	id: "x-skills",
	type: "topic",
	summary: "Manage mounted AI agent skills.",
	usage: "x-skills <install|add|import|update|list|remove|find|search|info> [args]",
	description: [
		"Install, add, import, and list skills stored under the mounted skills directory.",
		"Use install for Git repositories, add for local stdin/file markdown, and import for local skill directories.",
		"Run `x-skills add --help` for the single-file SKILL.md structure.",
		"Run `x-skills import --help` for the folder structure with optional bundled resources.",
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
			createAddSkillCommand(options),
			createImportSkillCommand(options),
			createUpdateSkillsCommand(options),
			createListSkillsCommand(options),
			createRemoveSkillCommand(options),
			createFindSkillsCommand(options),
			createSearchSkillsCommand(),
			createInfoSkillCommand(options),
		],
	});
}

export type SkillsFeature = Feature & {
	readonly add?: (input: AddSkillInput, ctx: CommandContext) => ReturnType<typeof addSkill>;
	readonly createCommand?: () => Command;
	readonly find?: (
		input: Parameters<typeof findSkills>[0],
		fs: IFileSystem,
	) => ReturnType<typeof findSkills>;
	readonly import?: (
		input: Parameters<typeof importSkill>[0],
		ctx: CommandContext,
	) => ReturnType<typeof importSkill>;
	readonly info?: (skillName: string, fs: IFileSystem) => ReturnType<typeof infoSkill>;
	readonly install?: (spec: string, ctx: CommandContext) => ReturnType<typeof installSkill>;
	readonly list?: (fs: IFileSystem) => ReturnType<typeof listSkills>;
	readonly remove?: (
		input: Parameters<typeof removeSkill>[0],
		ctx: CommandContext,
	) => ReturnType<typeof removeSkill>;
	readonly search?: (query: string) => ReturnType<typeof searchSkills>;
	readonly update?: (ctx: CommandContext) => ReturnType<typeof updateSkills>;
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

	if (!config.enabled) {
		return {
			name: "skills",
		};
	}

	const commandOptions: SkillsCommandOptions = {
		lockfile: config.lockfile,
		mountPoint: config.mountPoint,
	};
	const createMainCommand = () => createSkillsCommand(commandOptions);

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
		name: "skills",
		description: (ctx) => createSkillsFeatureDescription(ctx, config.mountPoint),
		command: [createMainCommand()],
		hooks: {
			onExecStart: (context) => initialize.run(context),
		},
		add: (input, ctx) => addSkill(input, ctx, commandOptions),
		createCommand: createMainCommand,
		find: (input, fs) => findSkills(input, fs, commandOptions),
		import: (input, ctx) => importSkill(input, ctx, commandOptions),
		info: (skillName, fs) => infoSkill(skillName, fs, commandOptions),
		install: (spec, ctx) => installSkill(spec, ctx, commandOptions),
		list: (fs) => listSkills(fs, commandOptions),
		remove: (input, ctx) => removeSkill(input, ctx, commandOptions),
		search: (query) => searchSkills(query),
		update: (ctx) => updateSkills(ctx, commandOptions),
	};
}

export type { SkillsCommandOptions, SkillsConfig, SkillsOptions } from "@/features/skills/types";
export { parseSkillInstallTarget } from "@/features/skills/utils/parser";
