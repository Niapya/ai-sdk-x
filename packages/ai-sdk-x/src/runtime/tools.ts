import type { Bash } from "just-bash";
import type { XConfig } from "@/types";
import type { Tool } from "ai";

type BashToolInput = {
	command: string;
	cwd?: string;
	stdin?: string;
};

type BashToolOutput = {
	stdout: string;
	stderr: string;
	exitCode: number;
};

export function createToolDescription(config: XConfig): string {
	return [
		"Execute bash commands in the AI SDK X virtual bash environment.",
		"",
		`WORKING DIRECTORY: ${config.bash.cwd}`,
		"All commands execute from this directory unless cwd is provided.",
		"",
		"Mounted directories:",
		`  ${config.workspace.mountPoint} - persistent workspace files`,
		`  ${config.skills.mountPoint} - installed skills and skills.json`,
		`  ${config.memory.mountPoint} - MEMORY.md and daily memory files`,
		"",
		"Custom commands:",
		"  x-skills list",
		"  x-skills install <repo-url>@<skill-name>",
		"  x-memory list",
		"  x-memory add <title>",
		"  x-memory search <query>",
		"  x-patch [path]",
	].join("\n");
}

export async function createBashTool(
	bash: Bash,
	description: string,
): Promise<Tool<BashToolInput, BashToolOutput>> {
	const { tool } = await import("ai");
	const { z } = await import("zod");

	if (!tool) {
		throw new Error("Failed to load 'ai' package.");
	}
	if (!z) {
		throw new Error("Failed to load 'zod' package.");
	}

	// 有可能会爆 context
	return tool<BashToolInput, BashToolOutput>({
		description,
		inputSchema: z.object({
			command: z.string().describe("The bash command to execute."),
			cwd: z.string().optional().describe("Optional working directory for this command."),
			stdin: z.string().optional().describe("Optional stdin passed to the command."),
		}),
		execute: async ({ command, cwd, stdin }) => {
			const result = await bash.exec(command, {
				...(cwd !== undefined ? { cwd } : {}),
				...(stdin !== undefined ? { stdin } : {}),
			});

			return {
				stdout: result.stdout,
				stderr: result.stderr,
				exitCode: result.exitCode,
			};
		},
	});
}
