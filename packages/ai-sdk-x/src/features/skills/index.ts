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
		"Skills are managed capability packages for agents: each skill is a directory with a SKILL.md/SKILLS.md entrypoint and metadata that explains when and how to use it.",
		'Use `x-skills` command through the bash tool. Put the shell command in command, for example command="x-skills list", command="x-skills install https://github.com/vercel-labs/agent-skills@vercel-composition-patterns", command="x-skills add --stdin" with stdin containing SKILL.md, command="x-skills add --file ./SKILL.md", or command="x-skills import ./my-skill".',
		"Run x-skills --help or x-skills <subcommand> --help when unsure.",
		"Most external skills are installed from Git repositories with `x-skills install <repo>@<skill-name>`. Local skills should be added with `x-skills add --stdin`, `x-skills add --file <path>`, or `x-skills import <directory>`; do not write directly into SKILLS_HOME to add a skill because the index and metadata would be unmanaged.",
		"Local skills must use the same shape as downloaded skills and include frontmatter metadata with at least name and description.",
		"Skill files can be read directly from this mount, and JavaScript or TypeScript helper code may import local skill files when appropriate; prefer .mjs or .mts modules for js-exec.",
		"`x-skills list` and `x-skills find` expose skill file paths; use those paths to inspect installed skill files.",
		installedText,
	].join("\n");
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
