import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { type ModelMessage, stepCountIs, ToolLoopAgent } from "ai";
import { X } from "ai-sdk-x";
import { ReadWriteFs } from "just-bash";

const ANSI = {
	reset: "\u001B[0m",
	cyan: "\u001B[36m",
	green: "\u001B[32m",
	yellow: "\u001B[33m",
	magenta: "\u001B[35m",
	red: "\u001B[31m",
	gray: "\u001B[90m",
} as const;

const LOG = {
	step: "agent-step",
	loop: "agent-loop",
	message: "message",
	reason: "reason",
	bash: "bash",
	command: "command",
	result: "result",
} as const;

function color(text: string, tone: keyof typeof ANSI): string {
	return `${ANSI[tone]}${text}${ANSI.reset}`;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../shell");
mkdirSync(root, { recursive: true });
const fs = new ReadWriteFs({ root });
const bash = X.init({
	fs,
});
const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY,
});

const tools = await bash.getTools();
const agent = new ToolLoopAgent({
	model: openrouter("deepseek/deepseek-v4-flash"),
	tools,
	stopWhen: stepCountIs(20),
	prepareStep: ({ stepNumber }) => {
		console.log(color(`[${LOG.step}:${stepNumber + 1}] start`, "cyan"));
		return {};
	},
	onStepFinish: ({
		stepNumber,
		finishReason,
		text,
		reasoningText,
		toolCalls,
		toolResults,
		usage,
	}) => {
		console.log(
			color(
				`[${LOG.step}:${stepNumber + 1}] finish=${finishReason} toolCalls=${toolCalls.length} toolResults=${toolResults.length} tokens=${usage.totalTokens}`,
				"cyan",
			),
		);

		if (text) {
			console.log(`${color(`[${LOG.step}:${stepNumber + 1}] ${LOG.message}:`, "green")} ${text}`);
		}

		if (reasoningText) {
			console.log(
				`${color(`[${LOG.step}:${stepNumber + 1}] ${LOG.reason}:`, "yellow")} ${reasoningText}`,
			);
		}

		for (const call of toolCalls) {
			if (call.toolName === "bash") {
				const bashInput = call.input as
					| { command?: string; cwd?: string; stdin?: string }
					| undefined;
				console.log(
					`${color(`[${LOG.step}:${stepNumber + 1}] ${LOG.bash} ${LOG.command}=`, "magenta")}${bashInput?.command ?? ""} ${color("cwd=", "gray")}${bashInput?.cwd ?? ""}`,
				);
				continue;
			}

			const callPayload = call.dynamic
				? call.input
				: {
						input: call.input,
					};
			console.log(
				color(
					`[${LOG.step}:${stepNumber + 1}] tool-call ${call.toolName}: ${JSON.stringify(callPayload)}`,
					"gray",
				),
			);
		}

		for (const result of toolResults) {
			if (result.toolName === "bash") {
				const output = result.output as
					| { stdout?: string; stderr?: string; exitCode?: number }
					| undefined;
				console.log(
					`${color(`[${LOG.step}:${stepNumber + 1}] ${LOG.bash} ${LOG.result}`, "magenta")} ${color("exitCode=", "gray")}${output?.exitCode ?? ""}`,
				);
				if (output?.stdout) {
					console.log(
						`${color(`[${LOG.step}:${stepNumber + 1}] ${LOG.bash} stdout:`, "magenta")}\n${output.stdout}`,
					);
				}
				if (output?.stderr) {
					console.log(
						`${color(`[${LOG.step}:${stepNumber + 1}] ${LOG.bash} stderr:`, "red")}\n${output.stderr}`,
					);
				}
				continue;
			}

			console.log(
				color(
					`[${LOG.step}:${stepNumber + 1}] tool-result ${result.toolName}: ${JSON.stringify(result.output)}`,
					"gray",
				),
			);
		}
	},
});

const rl = createInterface({ input: stdin, output: stdout });
let loopCount = 0;
const messages: ModelMessage[] = [];

console.log(`${color("Welcome to the AI SDK X Bash REPL!", "green")} ${root}`);
try {
	while (true) {
		const prompt = (await rl.question("you> ")).trim();
		if (!prompt) {
			continue;
		}

		if (["exit", "quit"].includes(prompt.toLowerCase())) {
			console.log(color(`[${LOG.loop}] stopped`, "yellow"));
			break;
		}

		loopCount += 1;
		console.log(color(`[${LOG.loop}:${loopCount}] start`, "cyan"));

		try {
			messages.push({ role: "user", content: prompt });
			const result = await agent.generate({ messages });
			messages.push(...result.response.messages);
			console.log(
				color(
					`[${LOG.loop}:${loopCount}] done history=${messages.length} finish=${result.finishReason}`,
					"cyan",
				),
			);
			console.log(result.text);
		} catch (error) {
			messages.pop();
			console.error(color(`[${LOG.loop}:${loopCount}] error`, "red"), error);
		}
	}
} finally {
	rl.close();
}
