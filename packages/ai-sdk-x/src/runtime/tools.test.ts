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

	it("does not request approval when approval is omitted", async () => {
		const executeCommand = async (): Promise<BashExecResult> => ({
			stdout: "",
			stderr: "",
			exitCode: 0,
			env: {},
		});

		const tool = await createBashTool(executeCommand, "demo");

		expect((tool as unknown as { needsApproval?: unknown }).needsApproval).toBeUndefined();
	});

	it("passes approval rules to the AI SDK tool", async () => {
		const executeCommand = async (): Promise<BashExecResult> => ({
			stdout: "",
			stderr: "",
			exitCode: 0,
			env: {},
		});

		const tool = await createBashTool(executeCommand, "demo", {
			approval: {
				defaultAction: "ask",
				rules: {
					pwd: "allow",
				},
			},
		});

		const approval = (
			tool as unknown as { needsApproval?: (input: { command: string }) => boolean }
		).needsApproval;
		expect(approval?.({ command: "pwd" })).toBe(false);
		expect(approval?.({ command: "rm -rf tmp" })).toBe(true);
	});

	it("uses dynamicAction for dynamic command approvals", async () => {
		const executeCommand = async (): Promise<BashExecResult> => ({
			stdout: "",
			stderr: "",
			exitCode: 0,
			env: {},
		});

		const tool = await createBashTool(executeCommand, "demo", {
			approval: {
				defaultAction: "allow",
				dynamicAction: "ask",
				rules: {
					"grep *": "allow",
				},
			},
		});

		const approval = (
			tool as unknown as { needsApproval?: (input: { command: string }) => boolean }
		).needsApproval;
		expect(approval?.({ command: "grep h" })).toBe(false);
		expect(approval?.({ command: "$CMD file | grep h" })).toBe(true);
	});

	it("denies execution for deny rules", async () => {
		const calls: string[] = [];
		const executeCommand = async (command: string): Promise<BashExecResult> => {
			calls.push(command);
			return {
				stdout: "",
				stderr: "",
				exitCode: 0,
				env: {},
			};
		};

		const tool = await createBashTool(executeCommand, "demo", {
			approval: {
				defaultAction: "allow",
				rules: {
					"git push *": "deny",
				},
			},
		});
		const executableTool = tool as unknown as {
			execute: (input: { command: string }) => Promise<unknown>;
		};
		await expect(executableTool.execute({ command: "git push origin main" })).rejects.toThrow(
			"Bash command denied by approval rules",
		);
		expect(calls).toEqual([]);
	});

	it("denies execution when any pipeline or nested command is denied", async () => {
		const calls: string[] = [];
		const executeCommand = async (command: string): Promise<BashExecResult> => {
			calls.push(command);
			return {
				stdout: "",
				stderr: "",
				exitCode: 0,
				env: {},
			};
		};

		const tool = await createBashTool(executeCommand, "demo", {
			approval: {
				defaultAction: "allow",
				rules: {
					"rm *": "deny",
				},
			},
		});
		const executableTool = tool as unknown as {
			execute: (input: { command: string }) => Promise<unknown>;
		};

		await expect(
			executableTool.execute({ command: "echo safe | grep safe && echo $(rm -rf build)" }),
		).rejects.toThrow("rm -rf build");
		expect(calls).toEqual([]);
	});
});
