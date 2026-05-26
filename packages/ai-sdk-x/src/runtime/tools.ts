import type { Tool } from "ai";
import type { BashExecResult, Command, ExecOptions } from "just-bash";
import { MAX_OUTPUT, type TruncateOutputOptions, truncateToolOutput } from "@/runtime/output";
import type { Feature, FeatureSetupContext, GetToolsOptions } from "@/types";

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

export async function createToolDescription(
	features: ReadonlyArray<Feature>,
	commands: ReadonlyArray<Command>,
	featureContext: FeatureSetupContext,
	options: GetToolsOptions = {},
): Promise<string> {
	const sections = [
		"Run shell commands in the mounted workspace.",
		[
			"Prefer grep, sed, head, tail, split, and similar tools when inspecting large files.",
			`Default cwd: ${featureContext.bash.getCwd()}`,
		].join("\n"),
	];

	const commandNames = commands.map((cmd) => cmd.name);
	if (commandNames.length > 0) {
		sections.push(`Available custom commands: ${commandNames.join(", ")}`);
	}

	const promptValues = await Promise.all(
		features.map(async (feature) => {
			if (!feature.prompt) {
				return undefined;
			}

			const prompt = await feature.prompt(featureContext);
			return prompt.trim();
		}),
	);

	const prompts = promptValues.filter((prompt): prompt is string => Boolean(prompt));
	if (prompts.length > 0) {
		sections.push(`Feature guidance:\n${prompts.join("\n")}`);
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
