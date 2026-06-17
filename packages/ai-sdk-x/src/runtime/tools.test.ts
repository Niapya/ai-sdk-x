import { describe, expect, it } from "bun:test";
import type { BashExecResult } from "just-bash";
import { createBashTool } from "@/runtime/tools";

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

	it("passes static needsApproval to the AI SDK tool", async () => {
		const executeCommand = async (): Promise<BashExecResult> => ({
			stdout: "",
			stderr: "",
			exitCode: 0,
			env: {},
		});

		const tool = await createBashTool(executeCommand, "demo", {
			needsApproval: true,
		});

		expect((tool as unknown as { needsApproval?: boolean }).needsApproval).toBe(true);
	});

	it("passes dynamic needsApproval to the AI SDK tool", async () => {
		const executeCommand = async (): Promise<BashExecResult> => ({
			stdout: "",
			stderr: "",
			exitCode: 0,
			env: {},
		});
		const needsApproval = ({ command }: { command: string }) => command.startsWith("git push");

		const tool = await createBashTool(executeCommand, "demo", {
			needsApproval,
		});
		const approval = (tool as unknown as { needsApproval: typeof needsApproval }).needsApproval;

		expect(approval({ command: "git push origin main" })).toBe(true);
		expect(approval({ command: "git status" })).toBe(false);
	});
});
