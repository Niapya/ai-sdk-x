import type { EmbeddingModel, Tool } from "ai";
import { cosineSimilarity, embedMany, tool } from "ai";
import { z } from "zod";


/** A single memory record returned by the adapter. */
export interface MemoryRecord {
	id: number;
	scope: string;
	content: string;
	createdAt: Date | null;
	updatedAt: Date | null;
}

/** Atomic DB operations – the user provides these, making the core ORM-agnostic. */
export interface MemoryAdapter {
	/** Insert a record and return it. */
	add(record: { scope: string; content: string }): Promise<MemoryRecord>;
	/** Query all records (optionally filtered by scope). */
	query(scope: string): Promise<MemoryRecord[]>;
	/** Update a record by id and return it. */
	update(id: number, data: { scope: string; content: string }): Promise<MemoryRecord>;
	/** Delete a record by id and return it. */
	delete(id: number): Promise<MemoryRecord>;
}

/** RAG configuration using AI SDK embeddings. */
export interface RAGConfig {
	/** The embedding model to use, e.g. openai.embeddingModel('text-embedding-3-small'). */
	model: EmbeddingModel;
	/** Extract the text to embed from a memory record. Defaults to JSON.stringify(record.content). */
	toText?: (record: MemoryRecord) => string;
	/** Minimum cosine similarity threshold (0–1). Records below this are filtered out. */
	threshold?: number;
}

export interface MemoryDebugOptions {
	enabled: boolean;
	logger?: (message: string) => void;
}

export interface MemoryHooks {
	onAdd?: (scope: string, content: string) => void;
	onQuery?: (scope: string, query: string) => void;
	onUpdate?: (scope: string, id: number, content: string) => void;
	onDelete?: (scope: string, id: number) => void;
}

export interface MemoryOptions {
	/** Atomic CRUD adapter – bring your own DB layer. */
	add: MemoryAdapter["add"];
	query: MemoryAdapter["query"];
	update?: MemoryAdapter["update"];
	delete?: MemoryAdapter["delete"];
	/**
	 *  Set to false to disable RAG, or provide a RAGConfig to enable embedding-based retrieval.
	 */
	rag?: false | RAGConfig;
	hooks?: MemoryHooks;
	debug?: MemoryDebugOptions;
}

export interface MemoryInstance {
	getTools: () => Promise<Record<string, Tool>>;
}

export type MemoryFactory = {
	(scope: string, config?: Partial<MemoryOptions>): MemoryInstance;
	(scopes: string[], config?: Partial<MemoryOptions>): MemoryInstance;
};



function debugLog(debug: MemoryDebugOptions | undefined, message: string): void {
	if (debug?.enabled) {
		const logger = debug.logger ?? console.log;
		logger(message);
	}
}

/**
 * Perform RAG retrieval: embed the query + all record texts in one batch,
 * then rank by cosine similarity and filter by threshold.
 */
async function ragRetrieve(
	ragConfig: RAGConfig,
	query: string,
	records: MemoryRecord[],
): Promise<MemoryRecord[]> {
	if (records.length === 0) return [];

	const toText = ragConfig.toText ?? ((r: MemoryRecord) => JSON.stringify(r.content));
	const threshold = ragConfig.threshold ?? 0;

	// Embed query + all record texts in one batch call
	const textsToEmbed = [query, ...records.map(toText)];
	const { embeddings } = await embedMany({
		model: ragConfig.model,
		values: textsToEmbed,
	});

	const queryEmbedding = embeddings[0];

	// Score each record by cosine similarity
	const scored = records.map((record, i) => ({
		record,
		score: cosineSimilarity(queryEmbedding, embeddings[i + 1]),
	}));

	// Filter by threshold and sort descending
	return scored
		.filter((s) => s.score >= threshold)
		.sort((a, b) => b.score - a.score)
		.map((s) => s.record);
}

/**
 * creteMemory is the main factory function that users will call to create a memory instance.
 * It accepts global options and returns a function that can be called with specific scopes and overrides.
 */
export function createMemory(options: MemoryOptions): MemoryFactory {
	const { add, query, update, delete: del, rag, hooks, debug } = options;

	function memory(
		scopeOrScopes: string | string[],
		config?: Partial<MemoryOptions>,
	): MemoryInstance {
		const effectiveAdd = config?.add ?? add;
		const effectiveQuery = config?.query ?? query;
		const effectiveUpdate = config?.update ?? update;
		const effectiveDelete = config?.delete ?? del;
		const effectiveRag = config?.rag !== undefined ? config.rag : rag;
		const effectiveHooks = config?.hooks ?? hooks;
		const effectiveDebug = config?.debug ?? debug;

		const scopes = Array.isArray(scopeOrScopes) ? scopeOrScopes : [scopeOrScopes];
		const isMultiScope = scopes.length > 1;

		async function addRecord(scope: string, content: string): Promise<MemoryRecord> {
			debugLog(effectiveDebug, `[memory] add scope="${scope}"`);
			effectiveHooks?.onAdd?.(scope, content);
			return effectiveAdd({ scope, content });
		}

		async function queryRecords(scope: string, queryText: string): Promise<MemoryRecord[]> {
			debugLog(effectiveDebug, `[memory] query scope="${scope}" q="${queryText}"`);
			effectiveHooks?.onQuery?.(scope, queryText);

			const records = await effectiveQuery(scope);

			if (effectiveRag) {
				return ragRetrieve(effectiveRag, queryText, records);
			}
			return records;
		}

		async function updateRecord(
			scope: string,
			id: number,
			content: string,
		): Promise<MemoryRecord> {
			if (!effectiveUpdate) throw new Error("update adapter not provided");
			debugLog(effectiveDebug, `[memory] update scope="${scope}" id=${id}`);
			effectiveHooks?.onUpdate?.(scope, id, content);
			return effectiveUpdate(id, { scope, content });
		}

		async function deleteRecord(scope: string, id: number): Promise<MemoryRecord> {
			if (!effectiveDelete) throw new Error("delete adapter not provided");
			debugLog(effectiveDebug, `[memory] delete scope="${scope}" id=${id}`);
			effectiveHooks?.onDelete?.(scope, id);
			return effectiveDelete(id);
		}
		return {
			getTools: async () => {
				const tools: Record<string, Tool> = {};

				if (isMultiScope) {
					const scopeEnum = z.enum(scopes as [string, ...string[]]);

					tools.addMemory = tool({
						description: "Add a new memory entry.",
						inputSchema: z.object({ scope: scopeEnum, content: z.string() }),
						execute: async ({ scope, content }) => addRecord(scope, content),
					});

					tools.queryMemory = tool({
						description: "Query memories.",
						inputSchema: z.object({ scope: scopeEnum, query: z.string() }),
						execute: async ({ scope, query: q }) => queryRecords(scope, q),
					});

					if (effectiveUpdate) {
						tools.updateMemory = tool({
							description: "Update an existing memory entry by ID.",
							inputSchema: z.object({
								scope: scopeEnum,
								id: z.number(),
								content: z.string(),
							}),
							execute: async ({ scope, id, content }) =>
								updateRecord(scope, id, content),
						});
					}

					if (effectiveDelete) {
						tools.deleteMemory = tool({
							description: "Delete a memory entry by ID.",
							inputSchema: z.object({ scope: scopeEnum, id: z.number() }),
							execute: async ({ scope, id }) => deleteRecord(scope, id),
						});
					}
				} else {
					const scope = scopes[0];

					tools.addMemory = tool({
						description: `Add a new memory entry to "${scope}".`,
						inputSchema: z.object({ content: z.string() }),
						execute: async ({ content }) => addRecord(scope, content),
					});

					tools.queryMemory = tool({
						description: `Query memories from "${scope}".`,
						inputSchema: z.object({ query: z.string() }),
						execute: async ({ query: q }) => queryRecords(scope, q),
					});

					if (effectiveUpdate) {
						tools.updateMemory = tool({
							description: `Update an existing memory entry in "${scope}" by ID.`,
							inputSchema: z.object({ id: z.number(), content: z.string() }),
							execute: async ({ id, content }) => updateRecord(scope, id, content),
						});
					}

					if (effectiveDelete) {
						tools.deleteMemory = tool({
							description: `Delete a memory entry from "${scope}" by ID.`,
							inputSchema: z.object({ id: z.number() }),
							execute: async ({ id }) => deleteRecord(scope, id),
						});
					}
				}

				return tools;
			},
		};
	}

	return memory as MemoryFactory;
}

