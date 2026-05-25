import type { Tool } from "ai";
import type { BashExecResult, ExecOptions } from "just-bash";
import { MAX_OUTPUT, type TruncateOutputOptions, truncateToolOutput } from "@/runtime/output";
import type { GetToolsOptions, XCommandMap, XConfig } from "@/types";

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

export function createToolDescription(
	config: XConfig,
	commands: XCommandMap,
	options: GetToolsOptions = {},
): string {
	const sections = [
		"Run shell commands in the mounted workspace.",
		[
			"Prefer grep, sed, head, tail, split, and similar tools when inspecting large files.",
			`Workspace mount: ${config.workspace.mountPoint}`,
			`Skills mount: ${config.skills.mountPoint}`,
			`Memory mount: ${config.memory.mountPoint}`,
			`Default cwd: ${config.bash.cwd}`,
		].join("\n"),
	];

	const commandNames = Object.values(commands)
		.filter((cmd): cmd is NonNullable<typeof cmd> => cmd !== undefined)
		.map((cmd) => cmd.name);
	if (commandNames.length > 0) {
		sections.push(`Available custom commands: ${commandNames.join(", ")}`);
	}

	if (options.description) {
		sections.push(options.description);
	}

	return sections.join("\n\n");
}

export async function createBashTool(
	executeCommand: (command: string, options?: ExecOptions) => Promise<BashExecResult>,
	description: string,
	options: TruncateOutputOptions = {},
): Promise<Tool<BashToolInput, BashToolOutput>> {
	const { tool } = await import("ai");
	const { z } = await import("zod");

	if (!tool) {
		throw new Error("Failed to load 'ai' package.");
	}
	if (!z) {
		throw new Error("Failed to load 'zod' package.");
	}

	return tool<BashToolInput, BashToolOutput>({
		description,
		inputSchema: z.object({
			command: z.string().describe("The bash command to execute."),
			cwd: z.string().optional().describe("Optional working directory for this command."),
			stdin: z.string().optional().describe("Optional stdin passed to the command."),
		}),
		execute: async ({ command, cwd, stdin }) => {
			const result = await executeCommand(command, {
				...(cwd !== undefined ? { cwd } : {}),
				...(stdin !== undefined ? { stdin } : {}),
			});
			const output = truncateToolOutput(result.stdout, result.stderr, {
				maxLines: options.maxLines,
				maxOutput: options.maxOutput ?? MAX_OUTPUT,
			});

			return {
				stdout: output.stdout,
				stderr: output.stderr,
				exitCode: result.exitCode,
			};
		},
	});
}
