import type { Tool } from "ai";
import { tool } from "ai";
import { createStorage, type Storage } from "unstorage";
import { z } from "zod";

type ExecutePayload<Language extends [string, ...string[]]> = {
	language: Language[number];
	code: string;
};

export type ExecutionStatus = "pending" | "completed" | "failed" | "killed";

export interface ExecutionRecord {
	id: string;
	status: ExecutionStatus;
	result?: string;
	error?: string;
	startedAt: number;
	completedAt?: number;
}

export interface ExecuteDebugOptions {
	enabled: boolean;
	logger?: (message: string) => void;
}

export interface ExecuteHooks {
	onExecute?: (id: string, payload: { language: string; code: string }) => void;
	onComplete?: (id: string, result: string) => void;
	onTimeout?: (id: string) => void;
	onError?: (id: string, error: unknown) => void;
	onKill?: (id: string) => void;
	onGetResult?: (id: string, record: ExecutionRecord | null) => void;
}

export interface ExecuteOptions<Language extends [string, ...string[]]> {
	storage?: Storage;

	lang: Language;
	execute(payload: ExecutePayload<Language>): Promise<string>;
	kill?(id: string): Promise<void>;

	/**
	 * Maximum time in milliseconds to wait for execution before returning a timeout ID.
	 * The execution continues in the background.
	 * @default 10000
	 */
	maxDelay?: number;

	hooks?: ExecuteHooks;
	debug?: ExecuteDebugOptions;
}

function generateId(): string {
	return `exec:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
}

function debugLog(debug: ExecuteDebugOptions | undefined, message: string): void {
	if (debug?.enabled) {
		const logger = debug.logger ?? console.log;
		logger(message);
	}
}

/**
 * execute creates a set of AI tools for executing code with timeout and background execution support.
 *
 * Tools created:
 * - `execute_code`: Execute code; returns result if done within `maxDelay`, otherwise returns an ID.
 * - `get_execution_result`: Retrieve the result of the last or a specific execution by ID.
 * - `kill_execution` (only if `kill` is provided): Kill a running execution by ID.
 *
 * @example
 * ```ts
 * const tools = execute({
 *   lang: ["typescript", "python"],
 *   execute: async ({ language, code }) => runCode(language, code),
 *   kill: async (id) => killProcess(id),
 *   maxDelay: 5000,
 * });
 * ```
 */
export function execute<Language extends [string, ...string[]]>(
	options: ExecuteOptions<Language>,
): Record<string, Tool> {
	const { storage = createStorage(), hooks, debug, maxDelay = 10000 } = options;
	const isMultiLanguage = options.lang.length > 1;
	let lastExecutionId: string | null = null;

	async function getRecord(id: string): Promise<ExecutionRecord | null> {
		if (storage) {
			return (await storage.getItem<ExecutionRecord>(`execute:${id}`)) ?? null;
		}
		return null;
	}

	async function setRecord(id: string, record: ExecutionRecord): Promise<void> {
		if (storage) {
			await storage.setItem(`execute:${id}`, record);
		}
	}

	const tools: Record<string, Tool> = {};

	// Build input schema dynamically based on number of supported languages
	const executeInputSchema = isMultiLanguage
		? z.object({
			language: z
				.enum(options.lang as [string, ...string[]])
				.describe(`The programming language. One of: ${options.lang.join(", ")}`),
			code: z.string().describe("The code to execute"),
		})
		: z.object({
			code: z.string().describe("The code to execute"),
		});

	tools.execute_code = tool({
		description: isMultiLanguage
			? `Execute code in one of the supported languages: ${options.lang.join(", ")}. Returns the result immediately if done within ${maxDelay}ms; otherwise returns a timeout ID and continues in the background.`
			: `Execute ${options.lang[0]} code. Returns the result immediately if done within ${maxDelay}ms; otherwise returns a timeout ID and continues in the background.`,
		inputSchema: executeInputSchema,
		execute: async (args) => {
			const id = generateId();
			const typedArgs = args as { language?: string; code: string };
			const language = typedArgs.language ?? options.lang[0];
			const { code } = typedArgs;

			debugLog(debug, `[execute] execute_code id="${id}" language="${language}"`);
			hooks?.onExecute?.(id, { language, code });

			const record: ExecutionRecord = {
				id,
				status: "pending",
				startedAt: Date.now(),
			};
			await setRecord(id, record);
			lastExecutionId = id;

			// Race execution against timeout
			const executionPromise = options.execute({
				language: language as Language[number],
				code,
			});

			const timeoutPromise = new Promise<"_timeout_">((resolve) =>
				setTimeout(() => resolve("_timeout_"), maxDelay),
			);

			const raceResult = await Promise.race([executionPromise, timeoutPromise]);

			if (raceResult === "_timeout_") {
				debugLog(debug, `[execute] timeout id="${id}" after ${maxDelay}ms`);
				hooks?.onTimeout?.(id);

				// Continue running in background; update record when done
				executionPromise
					.then(async (res) => {
						debugLog(debug, `[execute] background complete id="${id}"`);
						const current = await getRecord(id);
						if (current && current.status === "pending") {
							await setRecord(id, {
								...current,
								status: "completed",
								result: res,
								completedAt: Date.now(),
							});
							hooks?.onComplete?.(id, res);
						}
					})
					.catch(async (err) => {
						debugLog(debug, `[execute] background error id="${id}": ${err}`);
						const current = await getRecord(id);
						if (current && current.status === "pending") {
							await setRecord(id, {
								...current,
								status: "failed",
								error: String(err),
								completedAt: Date.now(),
							});
							hooks?.onError?.(id, err);
						}
					});

				return {
					status: "timeout",
					id,
					message: `Execution timed out after ${maxDelay}ms. Use get_execution_result with id="${id}" to fetch the result later.`,
				};
			}

			// Completed within delay
			const completed: ExecutionRecord = {
				...record,
				status: "completed",
				result: raceResult,
				completedAt: Date.now(),
			};
			await setRecord(id, completed);
			hooks?.onComplete?.(id, raceResult);
			debugLog(debug, `[execute] completed id="${id}"`);

			return { status: "completed", id, result: raceResult };
		},
	});

	tools.get_execution_result = tool({
		description:
			"Get the result of the last execution or a specific execution by ID. Returns status, result, and timing information.",
		inputSchema: z.object({
			id: z
				.string()
				.optional()
				.describe(
					"The execution ID to look up. If omitted, returns the result of the last execution.",
				),
		}),
		execute: async ({ id }) => {
			const targetId = id ?? lastExecutionId;
			debugLog(debug, `[execute] get_execution_result id="${targetId}"`);

			if (!targetId) {
				return { error: "No execution has been run yet." };
			}

			const record = await getRecord(targetId);
			hooks?.onGetResult?.(targetId, record);

			if (!record) {
				return { error: `No execution found with id="${targetId}".` };
			}

			return record;
		},
	});

	if (options.kill) {
		const killFn = options.kill;
		tools.kill_execution = tool({
			description: "Kill a running execution by ID.",
			inputSchema: z.object({
				id: z.string().describe("The execution ID to kill."),
			}),
			execute: async ({ id }) => {
				debugLog(debug, `[execute] kill_execution id="${id}"`);

				const record = await getRecord(id);
				if (!record) {
					return { error: `No execution found with id="${id}".` };
				}
				if (record.status !== "pending") {
					return {
						error: `Execution id="${id}" is not running (status="${record.status}").`,
					};
				}

				await killFn(id);

				const killed: ExecutionRecord = {
					...record,
					status: "killed",
					completedAt: Date.now(),
				};
				await setRecord(id, killed);
				hooks?.onKill?.(id);
				debugLog(debug, `[execute] killed id="${id}"`);

				return { status: "killed", id };
			},
		});
	}

	return tools;
}