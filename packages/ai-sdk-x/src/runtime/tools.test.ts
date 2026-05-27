import { describe, expect, it } from "bun:test";
import type { BashExecResult } from "just-bash";
import { createBashTool, createToolDescription } from "@/runtime/tools";
import type { Feature, FeatureSetupContext } from "@/types";

const commandStub = {
	trusted: true,
	execute: async () => ({
		stdout: "",
		stderr: "",
		exitCode: 0,
	}),
};

describe("createToolDescription", () => {
	it("renders command list, feature prompts, and custom description", async () => {
		const context = {
			bash: {
				getCwd: () => "/workspace/project",
			},
		} as FeatureSetupContext;

		const features: Feature[] = [
			{
				name: "one",
				prompt: async () => "  keep output short  ",
			},
			{
				name: "two",
				prompt: async () => "   ",
			},
			{
				name: "three",
			},
		];

		const description = await createToolDescription(
			features,
			[
				{ name: "x-one", ...commandStub },
				{ name: "x-two", ...commandStub },
			],
			context,
			{ description: "Only run safe commands." },
		);

		expect(description).toContain("Default cwd: /workspace/project");
		expect(description).toContain("Available custom commands: x-one, x-two");
		expect(description).toContain("Feature guidance:\nkeep output short");
		expect(description).toContain("Only run safe commands.");
		expect(description).not.toContain("\n\n\n");
	});
});

describe("createBashTool", () => {
	it("passes cwd/stdin to executeCommand and truncates output", async () => {
		const calls: Array<{ command: string; options: Record<string, string> }> = [];
		const executeCommand = async (
			command: string,
			options?: { cwd?: string; stdin?: string },
		): Promise<BashExecResult> => {
			calls.push({
				command,
				options: {
					...(options?.cwd ? { cwd: options.cwd } : {}),
					...(options?.stdin ? { stdin: options.stdin } : {}),
				},
			});

			return {
				stdout: "line1\nline2\nline3",
				stderr: "E".repeat(80),
				exitCode: 12,
				env: {},
			};
		};

		const tool = await createBashTool(executeCommand, "demo", {
			maxLines: 2,
			maxOutput: 24,
		});
		const executableTool = tool as unknown as { execute: (input: unknown) => Promise<unknown> };
		const result = await executableTool.execute({
			command: "cat logs",
			cwd: "/tmp/demo",
			stdin: "ping",
		});

		expect(calls).toEqual([
			{
				command: "cat logs",
				options: {
					cwd: "/tmp/demo",
					stdin: "ping",
				},
			},
		]);

		expect(result).toEqual({
			stdout: expect.stringContaining("line1\nline2"),
			stderr: expect.any(String),
			exitCode: 12,
		});
		expect((result as { stderr: string }).stderr.length).toBeLessThanOrEqual(24);
	});

	it("does not pass cwd/stdin when omitted", async () => {
		const optionsList: unknown[] = [];
		const executeCommand = async (command: string, options?: unknown): Promise<BashExecResult> => {
			expect(command).toBe("pwd");
			optionsList.push(options);
			return {
				stdout: "/tmp",
				stderr: "",
				exitCode: 0,
				env: {},
			};
		};

		const tool = await createBashTool(executeCommand, "demo");
		const executableTool = tool as unknown as { execute: (input: unknown) => Promise<unknown> };
		const result = await executableTool.execute({
			command: "pwd",
		});

		expect(optionsList).toEqual([{}]);
		expect(result).toEqual({
			stdout: "/tmp",
			stderr: "",
			exitCode: 0,
		});
	});
});
