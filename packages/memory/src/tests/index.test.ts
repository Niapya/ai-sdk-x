import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { MemoryRecord } from "../index";

// --- Mock the `ai` module before importing source ---

const mockEmbedMany = mock(() =>
	Promise.resolve({
		embeddings: [
			[1, 0],
			[0.9, 0.1],
			[0.1, 0.9],
		],
	}),
);

function cosineSim(a: number[], b: number[]): number {
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

mock.module("ai", () => ({
	tool: (opts: { execute: (...args: unknown[]) => unknown; description: string; inputSchema: unknown }) => opts,
	embedMany: mockEmbedMany,
	cosineSimilarity: cosineSim,
}));

// Import AFTER mock setup
const { createMemory } = await import("../index");

// --- In-memory adapter factory ---

function createInMemoryAdapter() {
	const records: MemoryRecord[] = [];
	let nextId = 1;

	return {
		records,
		add: async (record: { scope: string; content: string }): Promise<MemoryRecord> => {
			const newRecord: MemoryRecord = {
				id: nextId++,
				scope: record.scope,
				content: record.content,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			records.push(newRecord);
			return newRecord;
		},
		query: async (scope: string): Promise<MemoryRecord[]> => {
			return records.filter((r) => r.scope === scope);
		},
		update: async (
			id: number,
			data: { scope: string; content: string },
		): Promise<MemoryRecord> => {
			const index = records.findIndex((r) => r.id === id);
			if (index === -1) throw new Error("Not found");
			records[index] = { ...records[index], ...data, updatedAt: new Date() };
			return records[index];
		},
		delete: async (id: number): Promise<MemoryRecord> => {
			const index = records.findIndex((r) => r.id === id);
			if (index === -1) throw new Error("Not found");
			const deleted = records.splice(index, 1)[0];
			return deleted;
		},
	};
}

// --- Fake embedding model ---

const fakeEmbeddingModel = {
	specificationVersion: "v2",
	modelId: "fake-embedding",
	provider: "fake",
	maxEmbeddingsPerCall: 100,
	supportsParallelCalls: false,
} as unknown as import("ai").EmbeddingModel<string>;

// --- Tests ---

describe("createMemory", () => {
	let adapter: ReturnType<typeof createInMemoryAdapter>;

	beforeEach(() => {
		adapter = createInMemoryAdapter();
		mockEmbedMany.mockClear();
	});

	test("returns a factory function", () => {
		const factory = createMemory({
			add: adapter.add,
			query: adapter.query,
		});
		expect(typeof factory).toBe("function");
	});

	describe("single scope", () => {
		test("creates addMemory and queryMemory tools", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			expect(tools.addMemory).toBeDefined();
			expect(tools.queryMemory).toBeDefined();
			expect(tools.updateMemory).toBeUndefined();
			expect(tools.deleteMemory).toBeUndefined();
		});

		test("creates all 4 tools when update and delete are provided", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				update: adapter.update,
				delete: adapter.delete,
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			expect(tools.addMemory).toBeDefined();
			expect(tools.queryMemory).toBeDefined();
			expect(tools.updateMemory).toBeDefined();
			expect(tools.deleteMemory).toBeDefined();
		});

		test("addMemory tool calls adapter", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			const result = await tools.addMemory.execute({ content: "hello world" });
			expect(result).toBeDefined();

			const typed = result as MemoryRecord;
			expect(typed.id).toBe(1);
			expect(typed.scope).toBe("user-1");
			expect(typed.content).toBe("hello world");
			expect(adapter.records).toHaveLength(1);
		});

		test("queryMemory tool calls adapter", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "note 1" });
			await tools.addMemory.execute({ content: "note 2" });

			const result = await tools.queryMemory.execute({ query: "notes" });
			const typed = result as MemoryRecord[];
			expect(typed).toHaveLength(2);
		});

		test("updateMemory tool calls adapter", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				update: adapter.update,
				delete: adapter.delete,
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "original" });
			const updated = await tools.updateMemory.execute({ id: 1, content: "updated" });

			const typed = updated as MemoryRecord;
			expect(typed.content).toBe("updated");
		});

		test("deleteMemory tool calls adapter", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				update: adapter.update,
				delete: adapter.delete,
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "to delete" });
			expect(adapter.records).toHaveLength(1);

			const deleted = await tools.deleteMemory.execute({ id: 1 });
			const typed = deleted as MemoryRecord;
			expect(typed.content).toBe("to delete");
			expect(adapter.records).toHaveLength(0);
		});
	});

	describe("multi scope", () => {
		test("creates tools with scope enum parameter", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory(["work", "personal"]);
			const tools = await instance.getTools();

			expect(tools.addMemory).toBeDefined();
			expect(tools.queryMemory).toBeDefined();
			expect(tools.updateMemory).toBeUndefined();
			expect(tools.deleteMemory).toBeUndefined();
		});

		test("creates all 4 tools with update and delete", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				update: adapter.update,
				delete: adapter.delete,
			});
			const instance = factory(["work", "personal"]);
			const tools = await instance.getTools();

			expect(tools.addMemory).toBeDefined();
			expect(tools.queryMemory).toBeDefined();
			expect(tools.updateMemory).toBeDefined();
			expect(tools.deleteMemory).toBeDefined();
		});

		test("addMemory tool with scope", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory(["work", "personal"]);
			const tools = await instance.getTools();

			const result = await tools.addMemory.execute({ scope: "work", content: "meeting" });
			const typed = result as MemoryRecord;
			expect(typed.scope).toBe("work");
			expect(typed.content).toBe("meeting");
		});

		test("queryMemory tool with scope", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory(["work", "personal"]);
			const tools = await instance.getTools();

			await tools.addMemory.execute({ scope: "work", content: "task A" });
			await tools.addMemory.execute({ scope: "personal", content: "task B" });

			const results = await tools.queryMemory.execute({ scope: "work", query: "tasks" });
			const typed = results as MemoryRecord[];
			expect(typed).toHaveLength(1);
			expect(typed[0].scope).toBe("work");
		});

		test("updateMemory tool with scope", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				update: adapter.update,
				delete: adapter.delete,
			});
			const instance = factory(["work", "personal"]);
			const tools = await instance.getTools();

			await tools.addMemory.execute({ scope: "work", content: "old" });
			const updated = await tools.updateMemory.execute({
				scope: "work",
				id: 1,
				content: "new",
			});
			const typed = updated as MemoryRecord;
			expect(typed.content).toBe("new");
		});

		test("deleteMemory tool with scope", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				update: adapter.update,
				delete: adapter.delete,
			});
			const instance = factory(["work", "personal"]);
			const tools = await instance.getTools();

			await tools.addMemory.execute({ scope: "personal", content: "secret" });
			const deleted = await tools.deleteMemory.execute({ scope: "personal", id: 1 });
			const typed = deleted as MemoryRecord;
			expect(typed.content).toBe("secret");
			expect(adapter.records).toHaveLength(0);
		});
	});

	describe("update/delete adapter not provided", () => {
		test("no updateMemory tool when update adapter is missing", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			expect(tools.updateMemory).toBeUndefined();
		});

		test("no deleteMemory tool when delete adapter is missing", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			expect(tools.deleteMemory).toBeUndefined();
		});

		test("no updateMemory/deleteMemory in multi-scope without adapters", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory(["work", "personal"]);
			const tools = await instance.getTools();

			expect(tools.updateMemory).toBeUndefined();
			expect(tools.deleteMemory).toBeUndefined();
		});
	});

	describe("hooks", () => {
		test("onAdd hook is called", async () => {
			const onAdd = mock(() => {});
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				hooks: { onAdd },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "hooked" });
			expect(onAdd).toHaveBeenCalledTimes(1);
			expect(onAdd).toHaveBeenCalledWith("user-1", "hooked");
		});

		test("onQuery hook is called", async () => {
			const onQuery = mock(() => {});
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				hooks: { onQuery },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.queryMemory.execute({ query: "search term" });
			expect(onQuery).toHaveBeenCalledTimes(1);
			expect(onQuery).toHaveBeenCalledWith("user-1", "search term");
		});

		test("onUpdate hook is called", async () => {
			const onUpdate = mock(() => {});
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				update: adapter.update,
				hooks: { onUpdate },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "original" });
			await tools.updateMemory.execute({ id: 1, content: "changed" });
			expect(onUpdate).toHaveBeenCalledTimes(1);
			expect(onUpdate).toHaveBeenCalledWith("user-1", 1, "changed");
		});

		test("onDelete hook is called", async () => {
			const onDelete = mock(() => {});
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				delete: adapter.delete,
				hooks: { onDelete },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "temp" });
			await tools.deleteMemory.execute({ id: 1 });
			expect(onDelete).toHaveBeenCalledTimes(1);
			expect(onDelete).toHaveBeenCalledWith("user-1", 1);
		});
	});

	describe("debugLog", () => {
		test("logs with custom logger when debug is enabled", async () => {
			const logger = mock(() => {});
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				debug: { enabled: true, logger },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "debug test" });
			expect(logger).toHaveBeenCalledTimes(1);
			expect(logger.mock.calls[0][0]).toContain('[memory] add scope="user-1"');
		});

		test("logs with default console.log when no logger provided", async () => {
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				debug: { enabled: true },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "console test" });
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		test("does not log when debug is disabled", async () => {
			const logger = mock(() => {});
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				debug: { enabled: false, logger },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "silent" });
			expect(logger).not.toHaveBeenCalled();
		});

		test("does not log when debug is undefined", async () => {
			const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "no debug" });
			expect(consoleSpy).not.toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		test("debug logs for query, update, and delete operations", async () => {
			const logger = mock(() => {});
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				update: adapter.update,
				delete: adapter.delete,
				debug: { enabled: true, logger },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "item" });
			await tools.queryMemory.execute({ query: "search" });
			await tools.updateMemory.execute({ id: 1, content: "updated" });
			await tools.deleteMemory.execute({ id: 1 });

			expect(logger).toHaveBeenCalledTimes(4);
			expect(logger.mock.calls[1][0]).toContain("[memory] query");
			expect(logger.mock.calls[2][0]).toContain("[memory] update");
			expect(logger.mock.calls[3][0]).toContain("[memory] delete");
		});
	});

	describe("RAG retrieval", () => {
		test("queries with RAG enabled", async () => {
			mockEmbedMany.mockImplementation(() =>
				Promise.resolve({
					embeddings: [
						[1, 0],
						[0.95, 0.05],
						[0.1, 0.9],
					],
				}),
			);

			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				rag: { model: fakeEmbeddingModel },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "similar" });
			await tools.addMemory.execute({ content: "different" });

			const results = await tools.queryMemory.execute({ query: "similar" });
			const typed = results as MemoryRecord[];

			expect(mockEmbedMany).toHaveBeenCalled();
			// With default threshold 0, both records should be returned
			// but sorted by similarity (first one more similar)
			expect(typed.length).toBeGreaterThanOrEqual(1);
			expect(typed[0].content).toBe("similar");
		});

		test("returns empty array for empty records", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				rag: { model: fakeEmbeddingModel },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			const results = await tools.queryMemory.execute({ query: "anything" });
			const typed = results as MemoryRecord[];
			expect(typed).toHaveLength(0);
			// embedMany should NOT be called for empty records
			expect(mockEmbedMany).not.toHaveBeenCalled();
		});

		test("uses custom toText function", async () => {
			const toText = mock((r: MemoryRecord) => `custom:${r.content}`);

			mockEmbedMany.mockImplementation(() =>
				Promise.resolve({
					embeddings: [
						[1, 0],
						[0.9, 0.1],
					],
				}),
			);

			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				rag: { model: fakeEmbeddingModel, toText },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "test" });
			await tools.queryMemory.execute({ query: "test" });

			expect(toText).toHaveBeenCalled();
		});

		test("filters records below threshold", async () => {
			mockEmbedMany.mockImplementation(() =>
				Promise.resolve({
					embeddings: [
						[1, 0],
						[0.95, 0.05],
						[0.1, 0.9],
					],
				}),
			);

			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				rag: { model: fakeEmbeddingModel, threshold: 0.8 },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "close match" });
			await tools.addMemory.execute({ content: "far match" });

			const results = await tools.queryMemory.execute({ query: "close" });
			const typed = results as MemoryRecord[];

			// Only the first record should pass (similarity ~0.998)
			// The second has similarity ~0.105 which is below 0.8
			expect(typed).toHaveLength(1);
			expect(typed[0].content).toBe("close match");
		});

		test("returns all records with default threshold 0", async () => {
			mockEmbedMany.mockImplementation(() =>
				Promise.resolve({
					embeddings: [
						[1, 0],
						[0.5, 0.5],
						[0.1, 0.9],
					],
				}),
			);

			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				rag: { model: fakeEmbeddingModel },
			});
			const instance = factory("user-1");
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "a" });
			await tools.addMemory.execute({ content: "b" });

			const results = await tools.queryMemory.execute({ query: "test" });
			const typed = results as MemoryRecord[];
			expect(typed).toHaveLength(2);
		});
	});

	describe("config override", () => {
		test("factory call config overrides base options", async () => {
			const baseAdapter = createInMemoryAdapter();
			const overrideAdapter = createInMemoryAdapter();

			const factory = createMemory({
				add: baseAdapter.add,
				query: baseAdapter.query,
			});
			const instance = factory("user-1", {
				add: overrideAdapter.add,
				query: overrideAdapter.query,
			});
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "override test" });

			expect(baseAdapter.records).toHaveLength(0);
			expect(overrideAdapter.records).toHaveLength(1);
		});

		test("config with rag: false disables RAG", async () => {
			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				rag: { model: fakeEmbeddingModel },
			});
			const instance = factory("user-1", { rag: false });
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "no rag" });
			mockEmbedMany.mockClear();

			const results = await tools.queryMemory.execute({ query: "test" });
			const typed = results as MemoryRecord[];
			expect(typed).toHaveLength(1);
			// embedMany should NOT be called since RAG is disabled via config
			expect(mockEmbedMany).not.toHaveBeenCalled();
		});

		test("config overrides hooks", async () => {
			const baseHook = mock(() => {});
			const overrideHook = mock(() => {});

			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				hooks: { onAdd: baseHook },
			});
			const instance = factory("user-1", {
				hooks: { onAdd: overrideHook },
			});
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "test" });

			expect(baseHook).not.toHaveBeenCalled();
			expect(overrideHook).toHaveBeenCalledTimes(1);
		});

		test("config overrides debug", async () => {
			const baseLogger = mock(() => {});
			const overrideLogger = mock(() => {});

			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
				debug: { enabled: true, logger: baseLogger },
			});
			const instance = factory("user-1", {
				debug: { enabled: true, logger: overrideLogger },
			});
			const tools = await instance.getTools();

			await tools.addMemory.execute({ content: "test" });

			expect(baseLogger).not.toHaveBeenCalled();
			expect(overrideLogger).toHaveBeenCalledTimes(1);
		});

		test("config overrides update and delete", async () => {
			const overrideAdapter = createInMemoryAdapter();

			const factory = createMemory({
				add: adapter.add,
				query: adapter.query,
			});
			const instance = factory("user-1", {
				update: overrideAdapter.update,
				delete: overrideAdapter.delete,
			});
			const tools = await instance.getTools();

			expect(tools.updateMemory).toBeDefined();
			expect(tools.deleteMemory).toBeDefined();
		});
	});
});
