import type { Command } from "just-bash";
import { createInstallSkillCommand } from "@/commands/skills/install";
import { createListSkillsCommand } from "@/commands/skills/list";
import { createSearchSkillsCommand } from "@/commands/skills/search";
import type { SkillsCommandOptions } from "@/commands/skills/types";
import { createUpdateSkillsCommand } from "@/commands/skills/update";
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

export { parseSkillInstallTarget } from "@/commands/skills/utils/parser";
