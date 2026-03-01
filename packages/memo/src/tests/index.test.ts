import { describe, expect, mock, spyOn, test } from "bun:test";

// Mock the `ai` module so that `tool()` simply returns its options object.
// This makes `execute` a plain non-optional property.
mock.module("ai", () => ({
	tool: <T extends Record<string, unknown>>(opts: T) => opts,
}));

import type { ToolExecutionOptions } from "ai";
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import { z } from "zod";
import type { CacheEntry } from "../index";
import { createMemo } from "../index";

const execOptions: ToolExecutionOptions = {
	toolCallId: "test-call-id",
	messages: [],
};

interface WeatherResult {
	location: string;
	temperature: number;
}

function createWeatherTool(onExecute?: () => void) {
	return {
		description: "Get the weather",
		inputSchema: z.object({ location: z.string() }),
		execute: async (
			{ location }: { location: string },
			_opts: ToolExecutionOptions,
		): Promise<WeatherResult> => {
			onExecute?.();
			return { location, temperature: 72 };
		},
	};
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("createMemo", () => {
	describe("basic functionality", () => {
		test("returns a memo function", () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			expect(typeof memo).toBe("function");
		});

		test("memoized tool has cache management methods", () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			expect(typeof memoized.execute).toBe("function");
			expect(typeof memoized.get).toBe("function");
			expect(typeof memoized.set).toBe("function");
			expect(typeof memoized.update).toBe("function");
			expect(typeof memoized.delete).toBe("function");
		});

		test("memoized tool preserves original tool properties", () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			expect(memoized.description).toBe("Get the weather");
		});
	});

	describe("cache behavior with memory driver", () => {
		test("cache miss on first call, hit on second", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(weatherTool, "weather");

			const result1 = await memoized.execute({ location: "NYC" }, execOptions);
			expect(result1).toEqual({ location: "NYC", temperature: 72 });
			expect(callCount).toBe(1);

			const result2 = await memoized.execute({ location: "NYC" }, execOptions);
			expect(result2).toEqual({ location: "NYC", temperature: 72 });
			expect(callCount).toBe(1);
		});

		test("different args produce different cache entries", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			await memoized.execute({ location: "LA" }, execOptions);
			expect(callCount).toBe(2);
		});
	});

	describe("cache behavior with default storage (no driver)", () => {
		test("cache miss on first call, hit on second", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage();
			const memo = createMemo({ storage });
			const memoized = memo(weatherTool, "weather");

			const result1 = await memoized.execute({ location: "NYC" }, execOptions);
			expect(result1).toEqual({ location: "NYC", temperature: 72 });
			expect(callCount).toBe(1);

			const result2 = await memoized.execute({ location: "NYC" }, execOptions);
			expect(result2).toEqual({ location: "NYC", temperature: 72 });
			expect(callCount).toBe(1);
		});
	});

	describe("TTL", () => {
		test("returns cached value within TTL", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage, ttl: 5000 });
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);

			const result = await memoized.execute({ location: "NYC" }, execOptions);
			expect(result).toEqual({ location: "NYC", temperature: 72 });
			expect(callCount).toBe(1);
		});

		test("re-executes after TTL expiration", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage, ttl: 10 });
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);

			await Bun.sleep(30);

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(2);
		});

		test("caches indefinitely when no TTL is set", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);

			await Bun.sleep(50);

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);
		});
	});

	describe("maxSize", () => {
		test("caches result within maxSize limit", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage, maxSize: 10000 });
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);
		});

		test("skips caching when result exceeds maxSize", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage, maxSize: 5 });
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(2);
		});
	});

	describe("shouldCache", () => {
		test("executes directly when shouldCache returns false", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				shouldCache: () => false,
			});
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(2);
		});

		test("throws when shouldCache returns false and tool has no execute", async () => {
			const noExecTool = {
				description: "No execute",
				inputSchema: z.object({ query: z.string() }),
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				shouldCache: () => false,
			});
			const memoized = memo(noExecTool, "noexec");

			await expect(memoized.execute({ query: "test" }, execOptions)).rejects.toThrow(
				'Tool "noexec" has no execute method',
			);
		});

		test("caches normally when shouldCache returns true", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				shouldCache: () => true,
			});
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);
		});
	});

	describe("generateKey", () => {
		test("uses default key generation with stableStringify", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);

			const entry = await memoized.get('memo:weather:{"location":"NYC"}');
			expect(entry).not.toBeNull();
			expect(entry?.value).toEqual({ location: "NYC", temperature: 72 });
		});

		test("uses custom generateKey from options", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				generateKey: (name, params) => `custom:${name}:${JSON.stringify(params)}`,
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);

			const entry = await memoized.get(`custom:weather:${JSON.stringify({ location: "NYC" })}`);
			expect(entry).not.toBeNull();
		});

		test("per-tool generateKey overrides global", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				generateKey: () => "global-key",
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather", {
				generateKey: () => "tool-key",
			});

			await memoized.execute({ location: "NYC" }, execOptions);

			const globalEntry = await memoized.get("global-key");
			expect(globalEntry).toBeNull();

			const toolEntry = await memoized.get("tool-key");
			expect(toolEntry).not.toBeNull();
		});
	});

	describe("stableStringify via key generation", () => {
		test("handles object keys sorted consistently", async () => {
			let callCount = 0;
			const flexTool = {
				description: "Flexible tool",
				inputSchema: z.object({ b: z.string(), a: z.string() }),
				execute: async (args: { b: string; a: string }, _opts: ToolExecutionOptions) => {
					callCount++;
					return args;
				},
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(flexTool, "flex");

			await memoized.execute({ b: "two", a: "one" }, execOptions);
			expect(callCount).toBe(1);

			await memoized.execute({ a: "one", b: "two" }, execOptions);
			expect(callCount).toBe(1);
		});

		test("handles null values in args", async () => {
			const nullTool = {
				description: "Nullable tool",
				inputSchema: z.object({ value: z.string().nullable() }),
				execute: async (args: { value: string | null }, _opts: ToolExecutionOptions) => args,
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(nullTool, "nulltool");

			await memoized.execute({ value: null }, execOptions);

			const entry = await memoized.get('memo:nulltool:{"value":null}');
			expect(entry).not.toBeNull();
		});

		test("handles arrays in args", async () => {
			const arrTool = {
				description: "Array tool",
				inputSchema: z.object({ items: z.array(z.string()) }),
				execute: async (args: { items: string[] }, _opts: ToolExecutionOptions) => args,
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(arrTool, "arrtool");

			await memoized.execute({ items: ["a", "b"] }, execOptions);

			const entry = await memoized.get('memo:arrtool:{"items":["a","b"]}');
			expect(entry).not.toBeNull();
		});

		test("handles nested objects with sorted keys", async () => {
			const nestedTool = {
				description: "Nested tool",
				inputSchema: z.object({
					nested: z.object({ z: z.number(), a: z.number() }),
				}),
				execute: async (args: { nested: { z: number; a: number } }, _opts: ToolExecutionOptions) =>
					args,
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(nestedTool, "nested");

			await memoized.execute({ nested: { z: 2, a: 1 } }, execOptions);

			const entry = await memoized.get('memo:nested:{"nested":{"a":1,"z":2}}');
			expect(entry).not.toBeNull();
		});

		test("handles primitive values (string, number, boolean)", async () => {
			const primTool = {
				description: "Primitive tool",
				inputSchema: z.object({
					str: z.string(),
					num: z.number(),
					bool: z.boolean(),
				}),
				execute: async (
					args: {
						str: string;
						num: number;
						bool: boolean;
					},
					_opts: ToolExecutionOptions,
				) => args,
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(primTool, "prim");

			await memoized.execute({ str: "hello", num: 42, bool: true }, execOptions);

			const entry = await memoized.get('memo:prim:{"bool":true,"num":42,"str":"hello"}');
			expect(entry).not.toBeNull();
		});

		test("handles undefined values in args", async () => {
			const optTool = {
				description: "Optional tool",
				inputSchema: z.object({ value: z.string().optional() }),
				execute: async (_args: { value?: string }, _opts: ToolExecutionOptions) => ({
					received: true,
				}),
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(optTool, "opt");

			await memoized.execute({ value: undefined }, execOptions);

			const entry = await memoized.get('memo:opt:{"value":undefined}');
			expect(entry).not.toBeNull();
		});
	});

	describe("serializeValue / deserializeValue", () => {
		test("uses serializeValue when storing", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const serializeMock = mock((value: unknown, _toolName: string, _params: unknown) => {
				const v = value as Record<string, unknown>;
				return { ...v, serialized: true };
			});
			const memo = createMemo({
				storage,
				serializeValue: serializeMock,
			});
			const recordTool = {
				description: "Get the weather",
				inputSchema: z.object({ location: z.string() }),
				execute: async (
					{ location }: { location: string },
					_opts: ToolExecutionOptions,
				): Promise<Record<string, unknown>> => ({
					location,
					temperature: 72,
				}),
			};
			const memoized = memo(recordTool, "weather");

			const result = await memoized.execute({ location: "NYC" }, execOptions);
			expect(result).toEqual({ location: "NYC", temperature: 72 });
			expect(serializeMock).toHaveBeenCalledTimes(1);

			const entry = await memoized.get('memo:weather:{"location":"NYC"}');
			expect(entry?.value).toEqual({
				location: "NYC",
				temperature: 72,
				serialized: true,
			});
		});

		test("uses deserializeValue on cache hit with TTL", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const deserializeMock = mock((raw: unknown, _toolName: string, _params: unknown) => {
				const v = raw as Record<string, unknown>;
				return { ...v, deserialized: true };
			});
			const memo = createMemo({
				storage,
				ttl: 60000,
				deserializeValue: deserializeMock,
			});
			const recordTool = {
				description: "Get the weather",
				inputSchema: z.object({ location: z.string() }),
				execute: async (
					{ location }: { location: string },
					_opts: ToolExecutionOptions,
				): Promise<Record<string, unknown>> => ({
					location,
					temperature: 72,
				}),
			};
			const memoized = memo(recordTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);

			const result = await memoized.execute({ location: "NYC" }, execOptions);
			expect(deserializeMock).toHaveBeenCalledTimes(1);
			expect(result).toEqual({
				location: "NYC",
				temperature: 72,
				deserialized: true,
			});
		});

		test("uses deserializeValue on cache hit without TTL", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const deserializeMock = mock((raw: unknown, _toolName: string, _params: unknown) => {
				const v = raw as Record<string, unknown>;
				return { ...v, deserialized: true };
			});
			const memo = createMemo({
				storage,
				deserializeValue: deserializeMock,
			});
			const recordTool = {
				description: "Get the weather",
				inputSchema: z.object({ location: z.string() }),
				execute: async (
					{ location }: { location: string },
					_opts: ToolExecutionOptions,
				): Promise<Record<string, unknown>> => ({
					location,
					temperature: 72,
				}),
			};
			const memoized = memo(recordTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);

			const result = await memoized.execute({ location: "NYC" }, execOptions);
			expect(deserializeMock).toHaveBeenCalledTimes(1);
			expect(result).toEqual({
				location: "NYC",
				temperature: 72,
				deserialized: true,
			});
		});
	});

	describe("hooks", () => {
		test("calls onMiss on cache miss", async () => {
			const onMiss = mock((_name: string, _params: unknown) => {});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				hooks: { onMiss },
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(onMiss).toHaveBeenCalledTimes(1);
			expect(onMiss).toHaveBeenCalledWith("weather", {
				location: "NYC",
			});
		});

		test("calls onHit on cache hit (no TTL)", async () => {
			const onHit = mock((_name: string, _params: unknown, _cached: CacheEntry<unknown>) => {});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				hooks: { onHit },
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			await memoized.execute({ location: "NYC" }, execOptions);
			expect(onHit).toHaveBeenCalledTimes(1);
		});

		test("calls onHit on cache hit with TTL", async () => {
			const onHit = mock((_name: string, _params: unknown, _cached: CacheEntry<unknown>) => {});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				ttl: 60000,
				hooks: { onHit },
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			await memoized.execute({ location: "NYC" }, execOptions);
			expect(onHit).toHaveBeenCalledTimes(1);
		});

		test("calls onMiss on TTL expiration", async () => {
			const onMiss = mock((_name: string, _params: unknown) => {});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				ttl: 10,
				hooks: { onMiss },
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(onMiss).toHaveBeenCalledTimes(1);

			await Bun.sleep(30);

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(onMiss).toHaveBeenCalledTimes(2);
		});

		test("calls onStore after storing in cache", async () => {
			const onStore = mock((_name: string, _params: unknown, _value: unknown) => {});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				hooks: { onStore },
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(onStore).toHaveBeenCalledTimes(1);
			expect(onStore).toHaveBeenCalledWith(
				"weather",
				{ location: "NYC" },
				{ location: "NYC", temperature: 72 },
			);
		});

		test("calls onError on storage read error", async () => {
			const onError = mock((_name: string, _params: unknown, _error: unknown) => {});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				hooks: { onError },
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			const getItemSpy = spyOn(storage, "getItem");
			getItemSpy.mockRejectedValue(new Error("storage error"));

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(onError).toHaveBeenCalledTimes(1);

			getItemSpy.mockRestore();
		});
	});

	describe("debug logging", () => {
		test("logs with custom logger when debug enabled", async () => {
			const logMessages: string[] = [];
			const customLogger = (msg: string) => {
				logMessages.push(msg);
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				debug: { enabled: true, logger: customLogger },
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(logMessages.length).toBeGreaterThan(0);
			expect(logMessages.some((m) => m.includes("[memo]"))).toBe(true);
			expect(logMessages.some((m) => m.includes("cache miss"))).toBe(true);
			expect(logMessages.some((m) => m.includes("stored in cache"))).toBe(true);
		});

		test("logs with console.log when debug enabled without custom logger", async () => {
			const consoleSpy = spyOn(console, "log");
			consoleSpy.mockImplementation(() => {});

			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				debug: { enabled: true },
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		test("does not log when debug disabled", async () => {
			const logMessages: string[] = [];
			const customLogger = (msg: string) => {
				logMessages.push(msg);
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				debug: { enabled: false, logger: customLogger },
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(logMessages.length).toBe(0);
		});

		test("does not log when debug is undefined", async () => {
			const consoleSpy = spyOn(console, "log");
			consoleSpy.mockImplementation(() => {});

			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(consoleSpy).not.toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		test("logs TTL expiration", async () => {
			const logMessages: string[] = [];
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				ttl: 10,
				debug: {
					enabled: true,
					logger: (msg) => logMessages.push(msg),
				},
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			await Bun.sleep(30);
			await memoized.execute({ location: "NYC" }, execOptions);

			expect(logMessages.some((m) => m.includes("TTL expired"))).toBe(true);
		});

		test("logs shouldCache=false", async () => {
			const logMessages: string[] = [];
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				shouldCache: () => false,
				debug: {
					enabled: true,
					logger: (msg) => logMessages.push(msg),
				},
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(logMessages.some((m) => m.includes("shouldCache=false"))).toBe(true);
		});

		test("logs cache hit with no TTL", async () => {
			const logMessages: string[] = [];
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				debug: {
					enabled: true,
					logger: (msg) => logMessages.push(msg),
				},
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			await memoized.execute({ location: "NYC" }, execOptions);

			expect(logMessages.some((m) => m.includes("cache hit (no TTL)"))).toBe(true);
		});

		test("logs cache hit with TTL", async () => {
			const logMessages: string[] = [];
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				ttl: 60000,
				debug: {
					enabled: true,
					logger: (msg) => logMessages.push(msg),
				},
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			await memoized.execute({ location: "NYC" }, execOptions);

			expect(
				logMessages.some((m) => m.includes("cache hit") && !m.includes("cache hit (no TTL)")),
			).toBe(true);
		});

		test("logs maxSize exceeded", async () => {
			const logMessages: string[] = [];
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				maxSize: 5,
				debug: {
					enabled: true,
					logger: (msg) => logMessages.push(msg),
				},
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(logMessages.some((m) => m.includes("exceeds maxSize"))).toBe(true);
		});

		test("logs non-serializable result", async () => {
			const logMessages: string[] = [];
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				debug: {
					enabled: true,
					logger: (msg) => logMessages.push(msg),
				},
			});
			const blobTool = {
				description: "Returns a blob",
				inputSchema: z.object({}),
				execute: async (_args: Record<string, never>, _opts: ToolExecutionOptions) =>
					new Blob(["test"]),
			};
			const memoized = memo(blobTool, "blob");

			await memoized.execute({}, execOptions);
			expect(logMessages.some((m) => m.includes("not serializable"))).toBe(true);
		});

		test("logs error reading cache", async () => {
			const logMessages: string[] = [];
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				debug: {
					enabled: true,
					logger: (msg) => logMessages.push(msg),
				},
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			const spy = spyOn(storage, "getItem");
			spy.mockRejectedValue(new Error("read fail"));

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(logMessages.some((m) => m.includes("Error reading cache"))).toBe(true);

			spy.mockRestore();
		});
	});

	describe("non-serializable results", () => {
		test("skips caching for Blob results", async () => {
			let callCount = 0;
			const blobTool = {
				description: "Returns a blob",
				inputSchema: z.object({}),
				execute: async (_args: Record<string, never>, _opts: ToolExecutionOptions) => {
					callCount++;
					return new Blob(["test"]);
				},
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(blobTool, "blob");

			const result = await memoized.execute({}, execOptions);
			expect(result).toBeInstanceOf(Blob);
			expect(callCount).toBe(1);

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(2);
		});

		test("skips caching for ReadableStream results", async () => {
			let callCount = 0;
			const streamTool = {
				description: "Returns a stream",
				inputSchema: z.object({}),
				execute: async (_args: Record<string, never>, _opts: ToolExecutionOptions) => {
					callCount++;
					return new ReadableStream();
				},
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(streamTool, "stream");

			const result = await memoized.execute({}, execOptions);
			expect(result).toBeInstanceOf(ReadableStream);
			expect(callCount).toBe(1);

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(2);
		});

		test("skips caching for function results", async () => {
			let callCount = 0;
			const fnTool = {
				description: "Returns a function",
				inputSchema: z.object({}),
				execute: async (_args: Record<string, never>, _opts: ToolExecutionOptions) => {
					callCount++;
					return () => "hello";
				},
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(fnTool, "fn");

			const result = await memoized.execute({}, execOptions);
			expect(typeof result).toBe("function");
			expect(callCount).toBe(1);

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(2);
		});

		test("skips caching for bigint results", async () => {
			let callCount = 0;
			const bigintTool = {
				description: "Returns a bigint",
				inputSchema: z.object({}),
				execute: async (_args: Record<string, never>, _opts: ToolExecutionOptions) => {
					callCount++;
					return BigInt(42);
				},
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(bigintTool, "bigint");

			const result = await memoized.execute({}, execOptions);
			expect(result).toBe(BigInt(42));
			expect(callCount).toBe(1);

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(2);
		});

		test("skips caching for objects that fail JSON.stringify", async () => {
			let callCount = 0;
			const circularTool = {
				description: "Returns object with BigInt (fails JSON.stringify)",
				inputSchema: z.object({}),
				execute: async (_args: Record<string, never>, _opts: ToolExecutionOptions) => {
					callCount++;
					return { value: BigInt(1) };
				},
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(circularTool, "circular");

			const result = await memoized.execute({}, execOptions);
			expect(result).toEqual({ value: BigInt(1) });
			expect(callCount).toBe(1);

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(2);
		});

		test("caches null results", async () => {
			let callCount = 0;
			const nullTool = {
				description: "Returns null",
				inputSchema: z.object({}),
				execute: async (_args: Record<string, never>, _opts: ToolExecutionOptions) => {
					callCount++;
					return null;
				},
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(nullTool, "null");

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(1);

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(1);
		});

		test("caches string results", async () => {
			let callCount = 0;
			const strTool = {
				description: "Returns a string",
				inputSchema: z.object({}),
				execute: async (_args: Record<string, never>, _opts: ToolExecutionOptions) => {
					callCount++;
					return "hello";
				},
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(strTool, "str");

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(1);

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(1);
		});

		test("caches boolean results", async () => {
			let callCount = 0;
			const boolTool = {
				description: "Returns a boolean",
				inputSchema: z.object({}),
				execute: async (_args: Record<string, never>, _opts: ToolExecutionOptions) => {
					callCount++;
					return true;
				},
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(boolTool, "bool");

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(1);

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(1);
		});

		test("caches number results", async () => {
			let callCount = 0;
			const numTool = {
				description: "Returns a number",
				inputSchema: z.object({}),
				execute: async (_args: Record<string, never>, _opts: ToolExecutionOptions) => {
					callCount++;
					return 42;
				},
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(numTool, "num");

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(1);

			await memoized.execute({}, execOptions);
			expect(callCount).toBe(1);
		});
	});

	describe("manual cache management", () => {
		test("get returns null for missing key", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			const entry = await memoized.get("nonexistent");
			expect(entry).toBeNull();
		});

		test("set stores cache entry and get retrieves it", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.set("manual-key", {
				location: "test",
				temperature: 99,
			});

			const entry = await memoized.get("manual-key");
			expect(entry).not.toBeNull();
			expect(entry?.value).toEqual({
				location: "test",
				temperature: 99,
			});
			expect(entry?.metadata.timestamp).toBeGreaterThan(0);
		});

		test("update overwrites existing cache entry", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.set("update-key", {
				location: "old",
				temperature: 50,
			});
			await memoized.update("update-key", {
				location: "new",
				temperature: 100,
			});

			const entry = await memoized.get("update-key");
			expect(entry?.value).toEqual({
				location: "new",
				temperature: 100,
			});
		});

		test("delete removes cache entry", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			await memoized.set("delete-key", {
				location: "test",
				temperature: 72,
			});

			let entry = await memoized.get("delete-key");
			expect(entry).not.toBeNull();

			await memoized.delete("delete-key");

			entry = await memoized.get("delete-key");
			expect(entry).toBeNull();
		});
	});

	describe("tool without execute method", () => {
		test("throws when no execute method on cache miss", async () => {
			const noExecTool = {
				description: "No execute",
				inputSchema: z.object({ query: z.string() }),
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });
			const memoized = memo(noExecTool, "noexec");

			await expect(memoized.execute({ query: "test" }, execOptions)).rejects.toThrow(
				'Tool "noexec" has no execute method',
			);
		});

		test("throws when shouldCache is false and no execute method", async () => {
			const noExecTool = {
				description: "No execute",
				inputSchema: z.object({ query: z.string() }),
			};
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				shouldCache: () => false,
			});
			const memoized = memo(noExecTool, "noexec");

			await expect(memoized.execute({ query: "test" }, execOptions)).rejects.toThrow(
				'Tool "noexec" has no execute method',
			);
		});
	});

	describe("getCacheEntry edge cases", () => {
		test("returns null for entry without metadata.timestamp", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage });

			await storage.setItem('memo:weather:{"location":"NYC"}', {
				value: { location: "NYC", temperature: 72 },
			});

			let callCount = 0;
			const trackTool = createWeatherTool(() => {
				callCount++;
			});
			const memoized2 = memo(trackTool, "weather");

			await memoized2.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);
		});

		test("returns null and calls onError on storage error", async () => {
			const onError = mock((_name: string, _params: unknown, _error: unknown) => {});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				hooks: { onError },
			});
			const weatherTool = createWeatherTool();
			const memoized = memo(weatherTool, "weather");

			const spy = spyOn(storage, "getItem");
			spy.mockRejectedValue(new Error("read error"));

			const result = await memoized.execute({ location: "NYC" }, execOptions);
			expect(result).toEqual({ location: "NYC", temperature: 72 });
			expect(onError).toHaveBeenCalledTimes(1);

			spy.mockRestore();
		});
	});

	describe("per-tool config overrides", () => {
		test("tool config TTL overrides global TTL", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage, ttl: 10 });
			const memoized = memo(weatherTool, "weather", { ttl: 100000 });

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);

			await Bun.sleep(30);

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);
		});

		test("tool config maxSize overrides global maxSize", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({ storage, maxSize: 5 });
			const memoized = memo(weatherTool, "weather", { maxSize: 10000 });

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);

			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);
		});

		test("tool config shouldCache overrides global shouldCache", async () => {
			let callCount = 0;
			const weatherTool = createWeatherTool(() => {
				callCount++;
			});
			const storage = createStorage({ driver: memoryDriver() });
			const memo = createMemo({
				storage,
				shouldCache: () => false,
			});
			const memoized = memo(weatherTool, "weather", {
				shouldCache: () => true,
			});

			await memoized.execute({ location: "NYC" }, execOptions);
			await memoized.execute({ location: "NYC" }, execOptions);
			expect(callCount).toBe(1);
		});
	});
});
