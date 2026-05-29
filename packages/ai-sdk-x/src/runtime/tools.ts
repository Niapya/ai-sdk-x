import type { Tool } from "ai";
import type { BashExecResult, ExecOptions } from "just-bash";
import { MAX_OUTPUT, type TruncateOutputOptions, truncateToolOutput } from "@/runtime/output";

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

	return tool({
		description,
		inputSchema: z.object({
			command: z
				.string()
				.describe(
					'The full bash command to execute. Put shell code here, not in stdin. Examples include commands such as `sed -n "1,20p" file.ts` or `grep -n "TODO" src/index.ts` when those commands are available in the current environment.',
				),
			cwd: z
				.string()
				.optional()
				.describe(
					"Optional working directory for this command. Use this instead of starting the command with `cd`.",
				),
			stdin: z
				.string()
				.optional()
				.describe(
					"Optional raw stdin text passed to the executed process. Use this only when the command reads stdin.",
				),
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
