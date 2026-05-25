import type { ExecResult } from "just-bash";
import { type CliCommandDefinition, commandError, defineCliCommand } from "@/utils/command";

export function updateSkills(): ExecResult {
	return commandError("x-skills update is not implemented yet\n", 2);
}

export function createUpdateSkillsCommand(): CliCommandDefinition<undefined, undefined> {
	return defineCliCommand({
		id: "update",
		type: "command",
		summary: "Refresh installed skills from their sources.",
		usage: "x-skills update",
		run: () => updateSkills(),
	});
}
