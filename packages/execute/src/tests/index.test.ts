import { describe, expect, mock, spyOn, test } from "bun:test";

mock.module("ai", () => ({
	tool: (opts: Record<string, unknown>) => opts,
}));

import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import type { ExecutionRecord } from "../index";
import { execute as _execute } from "../index";

// biome-ignore lint/suspicious/noExplicitAny: re-typed for test simplicity
const execute = _execute as unknown as (...args: any[]) => any;

const toolExecOpts = { toolCallId: "test", messages: [] };

function createDeferred<T>(): {
	promise: Promise<T>;
	resolve: (value: T) => void;
	reject: (reason: unknown) => void;
} {
	let resolve: (value: T) => void = () => {};
	let reject: (reason: unknown) => void = () => {};
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe("execute", () => {
	describe("tools creation", () => {
		test("returns execute_code and get_execution_result tools", () => {
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "result",
			});
			expect(tools.execute_code).toBeDefined();
			expect(tools.get_execution_result).toBeDefined();
		});

		test("does not include kill_execution when kill is not provided", () => {
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "result",
			});
			expect(tools.kill_execution).toBeUndefined();
		});

		test("includes kill_execution when kill is provided", () => {
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "result",
				kill: async () => {},
			});
			expect(tools.kill_execution).toBeDefined();
		});
	});

	describe("single language", () => {
		test("description mentions specific language", () => {
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "result",
			});
			expect(tools.execute_code.description).toContain("typescript");
		});

		test("input schema has no language field", () => {
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "result",
			});
			const schema = tools.execute_code.inputSchema;
			expect(schema).toBeDefined();
			if (schema && typeof schema === "object" && "shape" in schema) {
				const shape = (schema as Record<string, unknown>).shape;
				if (shape && typeof shape === "object") {
					expect("language" in shape).toBe(false);
					expect("code" in shape).toBe(true);
				}
			}
		});

		test("uses default language when not provided in args", async () => {
			const payloads: Array<{ language: string; code: string }> = [];
			const tools = execute({
				lang: ["typescript"],
				execute: async (payload: { language: string; code: string }) => {
					payloads.push(payload);
					return "ok";
				},
			});
			await tools.execute_code.execute?.({ code: "test" }, toolExecOpts);
			expect(payloads[0].language).toBe("typescript");
		});
	});

	describe("multi language", () => {
		test("description mentions all supported languages", () => {
			const tools = execute({
				lang: ["typescript", "python"],
				execute: async () => "result",
			});
			expect(tools.execute_code.description).toContain("typescript");
			expect(tools.execute_code.description).toContain("python");
		});

		test("input schema includes language field", () => {
			const tools = execute({
				lang: ["typescript", "python"],
				execute: async () => "result",
			});
			const schema = tools.execute_code.inputSchema;
			if (schema && typeof schema === "object" && "shape" in schema) {
				const shape = (schema as Record<string, unknown>).shape;
				if (shape && typeof shape === "object") {
					expect("language" in shape).toBe(true);
					expect("code" in shape).toBe(true);
				}
			}
		});

		test("uses language from args", async () => {
			const payloads: Array<{ language: string; code: string }> = [];
			const tools = execute({
				lang: ["typescript", "python"],
				execute: async (payload: { language: string; code: string }) => {
					payloads.push(payload);
					return "ok";
				},
			});
			await tools.execute_code.execute?.({ language: "python", code: "print(1)" }, toolExecOpts);
			expect(payloads[0].language).toBe("python");
		});
	});

	describe("execute_code", () => {
		test("completes within maxDelay and returns result", async () => {
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "42",
				maxDelay: 5000,
			});
			const result = await tools.execute_code.execute?.({ code: "21 * 2" }, toolExecOpts);
			expect(result.status).toBe("completed");
			expect(result.result).toBe("42");
			expect(result.id).toMatch(/^exec:\d+:/);
		});

		test("returns timeout when execution exceeds maxDelay", async () => {
			const tools = execute({
				lang: ["typescript"],
				execute: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					return "delayed";
				},
				maxDelay: 10,
			});
			const result = await tools.execute_code.execute?.({ code: "slow" }, toolExecOpts);
			expect(result.status).toBe("timeout");
			expect(result.message).toContain("timed out");
			expect(result.id).toMatch(/^exec:/);
		});

		test("background completion after timeout updates record", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					return "delayed result";
				},
				maxDelay: 10,
			});
			const result = await tools.execute_code.execute?.({ code: "slow" }, toolExecOpts);
			expect(result.status).toBe("timeout");

			await new Promise((resolve) => setTimeout(resolve, 200));

			const record = await tools.get_execution_result.execute?.({ id: result.id }, toolExecOpts);
			expect(record.status).toBe("completed");
			expect(record.result).toBe("delayed result");
			expect(record.completedAt).toBeDefined();
		});

		test("background error after timeout updates record", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					throw new Error("execution failed");
				},
				maxDelay: 10,
			});
			const result = await tools.execute_code.execute?.({ code: "fail" }, toolExecOpts);
			expect(result.status).toBe("timeout");

			await new Promise((resolve) => setTimeout(resolve, 200));

			const record = await tools.get_execution_result.execute?.({ id: result.id }, toolExecOpts);
			expect(record.status).toBe("failed");
			expect(record.error).toContain("execution failed");
			expect(record.completedAt).toBeDefined();
		});

		test("background completion skipped when record is no longer pending", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const deferred = createDeferred<string>();
			const onComplete = mock((_id: string, _result: string) => {});
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => deferred.promise,
				kill: async () => {},
				maxDelay: 10,
				hooks: { onComplete },
			});
			const result = await tools.execute_code.execute?.({ code: "long" }, toolExecOpts);
			expect(result.status).toBe("timeout");

			// Kill it before background resolves
			await tools.kill_execution.execute?.({ id: result.id }, toolExecOpts);

			// Now resolve the background execution
			deferred.resolve("late result");
			await new Promise((resolve) => setTimeout(resolve, 50));

			// onComplete should NOT have been called (record was killed, not pending)
			expect(onComplete).not.toHaveBeenCalled();

			const record = await tools.get_execution_result.execute?.({ id: result.id }, toolExecOpts);
			expect(record.status).toBe("killed");
		});

		test("background error skipped when record is no longer pending", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const deferred = createDeferred<string>();
			const onError = mock((_id: string, _error: unknown) => {});
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => deferred.promise,
				kill: async () => {},
				maxDelay: 10,
				hooks: { onError },
			});
			const result = await tools.execute_code.execute?.({ code: "long" }, toolExecOpts);
			expect(result.status).toBe("timeout");

			// Kill it before background rejects
			await tools.kill_execution.execute?.({ id: result.id }, toolExecOpts);

			// Now reject the background execution
			deferred.reject(new Error("late error"));
			await new Promise((resolve) => setTimeout(resolve, 50));

			// onError should NOT have been called (record was killed, not pending)
			expect(onError).not.toHaveBeenCalled();

			const record = await tools.get_execution_result.execute?.({ id: result.id }, toolExecOpts);
			expect(record.status).toBe("killed");
		});
	});

	describe("get_execution_result", () => {
		test("returns error when no execution has run yet", async () => {
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "result",
			});
			const result = await tools.get_execution_result.execute?.({}, toolExecOpts);
			expect(result.error).toBe("No execution has been run yet.");
		});

		test("returns record by specific ID", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => "found",
			});
			const execResult = await tools.execute_code.execute?.({ code: "1" }, toolExecOpts);
			const record = await tools.get_execution_result.execute?.(
				{ id: execResult.id },
				toolExecOpts,
			);
			expect(record.status).toBe("completed");
			expect(record.result).toBe("found");
		});

		test("uses lastExecutionId when no ID provided", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => "last",
			});
			await tools.execute_code.execute?.({ code: "1" }, toolExecOpts);
			const record = await tools.get_execution_result.execute?.({}, toolExecOpts);
			expect(record.status).toBe("completed");
			expect(record.result).toBe("last");
		});

		test("returns error when record not found", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => "result",
			});
			const result = await tools.get_execution_result.execute?.(
				{ id: "nonexistent-id" },
				toolExecOpts,
			);
			expect(result.error).toContain("No execution found");
		});
	});

	describe("kill_execution", () => {
		test("kills a pending execution", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const deferred = createDeferred<string>();
			const killFn = mock(async (_id: string): Promise<void> => {});
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => deferred.promise,
				kill: killFn,
				maxDelay: 10,
			});
			const result = await tools.execute_code.execute?.({ code: "slow" }, toolExecOpts);
			expect(result.status).toBe("timeout");

			const killResult = await tools.kill_execution.execute?.({ id: result.id }, toolExecOpts);
			expect(killResult.status).toBe("killed");
			expect(killResult.id).toBe(result.id);
			expect(killFn).toHaveBeenCalledTimes(1);

			// Clean up deferred
			deferred.resolve("done");
		});

		test("returns error when record not found", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => "result",
				kill: async () => {},
			});
			const result = await tools.kill_execution.execute?.({ id: "nonexistent" }, toolExecOpts);
			expect(result.error).toContain("No execution found");
		});

		test("returns error when execution is not pending", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => "done",
				kill: async () => {},
			});
			const execResult = await tools.execute_code.execute?.({ code: "fast" }, toolExecOpts);
			expect(execResult.status).toBe("completed");

			const killResult = await tools.kill_execution.execute?.({ id: execResult.id }, toolExecOpts);
			expect(killResult.error).toContain("is not running");
		});
	});

	describe("hooks", () => {
		test("calls onExecute hook with id and payload", async () => {
			const onExecute = mock((_id: string, _payload: { language: string; code: string }) => {});
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "result",
				hooks: { onExecute },
			});
			await tools.execute_code.execute?.({ code: "test code" }, toolExecOpts);

			expect(onExecute).toHaveBeenCalledTimes(1);
			const [id, payload] = onExecute.mock.calls[0];
			expect(id).toMatch(/^exec:/);
			expect(payload).toEqual({ language: "typescript", code: "test code" });
		});

		test("calls onComplete hook on immediate success", async () => {
			const onComplete = mock((_id: string, _result: string) => {});
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "42",
				hooks: { onComplete },
			});
			await tools.execute_code.execute?.({ code: "21*2" }, toolExecOpts);

			expect(onComplete).toHaveBeenCalledTimes(1);
			const [id, result] = onComplete.mock.calls[0];
			expect(id).toMatch(/^exec:/);
			expect(result).toBe("42");
		});

		test("calls onTimeout hook when execution exceeds maxDelay", async () => {
			const onTimeout = mock((_id: string) => {});
			const tools = execute({
				lang: ["typescript"],
				execute: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					return "late";
				},
				maxDelay: 10,
				hooks: { onTimeout },
			});
			await tools.execute_code.execute?.({ code: "slow" }, toolExecOpts);

			expect(onTimeout).toHaveBeenCalledTimes(1);
			expect(onTimeout.mock.calls[0][0]).toMatch(/^exec:/);
		});

		test("calls onComplete hook from background completion", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const onComplete = mock((_id: string, _result: string) => {});
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					return "bg result";
				},
				maxDelay: 10,
				hooks: { onComplete },
			});
			await tools.execute_code.execute?.({ code: "slow" }, toolExecOpts);

			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(onComplete).toHaveBeenCalledTimes(1);
			expect(onComplete.mock.calls[0][1]).toBe("bg result");
		});

		test("calls onError hook from background error", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const onError = mock((_id: string, _error: unknown) => {});
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					throw new Error("bg error");
				},
				maxDelay: 10,
				hooks: { onError },
			});
			await tools.execute_code.execute?.({ code: "fail" }, toolExecOpts);

			await new Promise((resolve) => setTimeout(resolve, 200));

			expect(onError).toHaveBeenCalledTimes(1);
			const [id, error] = onError.mock.calls[0];
			expect(id).toMatch(/^exec:/);
			expect(String(error)).toContain("bg error");
		});

		test("calls onKill hook", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const deferred = createDeferred<string>();
			const onKill = mock((_id: string) => {});
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => deferred.promise,
				kill: async () => {},
				maxDelay: 10,
				hooks: { onKill },
			});
			const result = await tools.execute_code.execute?.({ code: "slow" }, toolExecOpts);
			await tools.kill_execution.execute?.({ id: result.id }, toolExecOpts);

			expect(onKill).toHaveBeenCalledTimes(1);
			expect(onKill.mock.calls[0][0]).toBe(result.id);

			deferred.resolve("done");
		});

		test("calls onGetResult hook", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const onGetResult = mock((_id: string, _record: ExecutionRecord | null) => {});
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => "result",
				hooks: { onGetResult },
			});
			const execResult = await tools.execute_code.execute?.({ code: "1" }, toolExecOpts);
			await tools.get_execution_result.execute?.({ id: execResult.id }, toolExecOpts);

			expect(onGetResult).toHaveBeenCalledTimes(1);
			const [id, record] = onGetResult.mock.calls[0];
			expect(id).toBe(execResult.id);
			expect(record).toBeDefined();
			if (record) {
				expect(record.status).toBe("completed");
			}
		});

		test("calls onGetResult with null when record not found", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const onGetResult = mock((_id: string, _record: ExecutionRecord | null) => {});
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => "result",
				hooks: { onGetResult },
			});
			await tools.get_execution_result.execute?.({ id: "missing" }, toolExecOpts);

			expect(onGetResult).toHaveBeenCalledTimes(1);
			const [id, record] = onGetResult.mock.calls[0];
			expect(id).toBe("missing");
			expect(record).toBeNull();
		});
	});

	describe("debug logging", () => {
		test("logs with custom logger when debug enabled", async () => {
			const logger = mock((_message: string) => {});
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "result",
				debug: { enabled: true, logger },
			});
			await tools.execute_code.execute?.({ code: "test" }, toolExecOpts);

			expect(logger).toHaveBeenCalled();
			const firstMsg = logger.mock.calls[0][0];
			expect(firstMsg).toContain("[execute]");
			expect(firstMsg).toContain("execute_code");
		});

		test("uses console.log when no custom logger provided", async () => {
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
			try {
				const tools = execute({
					lang: ["typescript"],
					execute: async () => "result",
					debug: { enabled: true },
				});
				await tools.execute_code.execute?.({ code: "test" }, toolExecOpts);

				expect(consoleSpy).toHaveBeenCalled();
			} finally {
				consoleSpy.mockRestore();
			}
		});

		test("does not log when debug is disabled", async () => {
			const logger = mock((_message: string) => {});
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "result",
				debug: { enabled: false, logger },
			});
			await tools.execute_code.execute?.({ code: "test" }, toolExecOpts);

			expect(logger).not.toHaveBeenCalled();
		});

		test("does not log when debug is undefined", async () => {
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
			try {
				const tools = execute({
					lang: ["typescript"],
					execute: async () => "result",
				});
				await tools.execute_code.execute?.({ code: "test" }, toolExecOpts);

				expect(consoleSpy).not.toHaveBeenCalled();
			} finally {
				consoleSpy.mockRestore();
			}
		});

		test("logs debug for timeout, background, get_result, and kill paths", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const logger = mock((_message: string) => {});
			const deferred = createDeferred<string>();
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => deferred.promise,
				kill: async () => {},
				maxDelay: 10,
				debug: { enabled: true, logger },
			});

			// Trigger execute_code → timeout
			const result = await tools.execute_code.execute?.({ code: "slow" }, toolExecOpts);
			expect(result.status).toBe("timeout");

			// Check timeout log
			const timeoutLogs = logger.mock.calls.map((c) => c[0]);
			expect(timeoutLogs.some((m) => m.includes("timeout"))).toBe(true);

			// Trigger get_execution_result
			await tools.get_execution_result.execute?.({ id: result.id }, toolExecOpts);
			const getResultLogs = logger.mock.calls.map((c) => c[0]);
			expect(getResultLogs.some((m) => m.includes("get_execution_result"))).toBe(true);

			// Trigger kill_execution
			await tools.kill_execution.execute?.({ id: result.id }, toolExecOpts);
			const killLogs = logger.mock.calls.map((c) => c[0]);
			expect(killLogs.some((m) => m.includes("kill_execution"))).toBe(true);
			expect(killLogs.some((m) => m.includes("killed"))).toBe(true);

			// Resolve deferred and wait for background complete log
			deferred.resolve("bg done");
			await new Promise((resolve) => setTimeout(resolve, 50));

			const bgLogs = logger.mock.calls.map((c) => c[0]);
			expect(bgLogs.some((m) => m.includes("background complete"))).toBe(true);
		});

		test("logs debug for background error path", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const logger = mock((_message: string) => {});
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					throw new Error("bg fail");
				},
				maxDelay: 10,
				debug: { enabled: true, logger },
			});

			await tools.execute_code.execute?.({ code: "fail" }, toolExecOpts);
			await new Promise((resolve) => setTimeout(resolve, 200));

			const allLogs = logger.mock.calls.map((c) => c[0]);
			expect(allLogs.some((m) => m.includes("background error"))).toBe(true);
		});
	});

	describe("storage", () => {
		test("works with custom storage (memory driver)", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const tools = execute({
				lang: ["typescript"],
				storage,
				execute: async () => "stored",
			});
			const execResult = await tools.execute_code.execute?.({ code: "1" }, toolExecOpts);
			const record = await tools.get_execution_result.execute?.(
				{ id: execResult.id },
				toolExecOpts,
			);
			expect(record.result).toBe("stored");
		});

		test("works with default storage (no custom storage)", async () => {
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "default",
			});
			const execResult = await tools.execute_code.execute?.({ code: "1" }, toolExecOpts);
			const record = await tools.get_execution_result.execute?.(
				{ id: execResult.id },
				toolExecOpts,
			);
			expect(record.result).toBe("default");
		});
	});

	describe("generateId", () => {
		test("generates unique IDs across multiple executions", async () => {
			const tools = execute({
				lang: ["typescript"],
				execute: async () => "result",
			});
			const r1 = await tools.execute_code.execute?.({ code: "1" }, toolExecOpts);
			const r2 = await tools.execute_code.execute?.({ code: "2" }, toolExecOpts);
			expect(r1.id).not.toBe(r2.id);
			expect(r1.id).toMatch(/^exec:\d+:[a-z0-9]+$/);
			expect(r2.id).toMatch(/^exec:\d+:[a-z0-9]+$/);
		});
	});
});
