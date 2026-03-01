import type { Tool, ToolExecutionOptions } from "ai";
import type { Storage } from "unstorage";

// biome-ignore lint/suspicious/noExplicitAny: Tool input/output can be any
type ToolInput<T extends Tool<any, any>> = T extends Tool<infer I, any> ? I : never;

// biome-ignore lint/suspicious/noExplicitAny: Tool input/output can be any
type ToolOutput<T extends Tool<any, any>> = T extends Tool<any, infer O> ? O : never;

export interface CacheEntry<T> {
	value: T;
	metadata: {
		timestamp: number;
	};
}

export interface MemoDebugOptions {
	enabled: boolean;
	logger?: (message: string) => void;
}

export interface MemoHooks<RESULT> {
	onHit?: (toolName: string, params: unknown, cached: CacheEntry<RESULT>) => void;
	onMiss?: (toolName: string, params: unknown) => void;
	onStore?: (toolName: string, params: unknown, value: RESULT) => void;
	onError?: (toolName: string, params: unknown, error: unknown) => void;
}

export interface MemoOptions<RESULT = unknown> {
	storage: Storage;
	ttl?: number;
	maxSize?: number;
	shouldCache?: (toolName: string, params: unknown) => boolean;
	generateKey?: (toolName: string, params: unknown) => string;
	serializeValue?: (value: RESULT, toolName: string, params: unknown) => unknown;
	deserializeValue?: (raw: unknown, toolName: string, params: unknown) => RESULT;
	hooks?: MemoHooks<RESULT>;
	debug?: MemoDebugOptions;
}

export interface MemoToolConfig {
	ttl?: number;
	maxSize?: number;
	shouldCache?: (toolName: string, params: unknown) => boolean;
	generateKey?: (toolName: string, params: unknown) => string;
}

export type MemoizedTool<T extends Tool> = Omit<T, "execute"> & {
	execute: (args: ToolInput<T>, options: ToolExecutionOptions) => Promise<ToolOutput<T>>;
	get: (key: string) => Promise<CacheEntry<ToolOutput<T>> | null>;
	set: (key: string, value: ToolOutput<T>) => Promise<void>;
	update: (key: string, value: ToolOutput<T>) => Promise<void>;
	delete: (key: string) => Promise<void>;
};
function stableStringify(obj: unknown): string {
	if (obj === null || obj === undefined) return String(obj);
	if (typeof obj !== "object") return JSON.stringify(obj);
	if (Array.isArray(obj)) {
		return `[${obj.map(stableStringify).join(",")}]`;
	}
	const keys = Object.keys(obj as Record<string, unknown>).sort();
	const parts = keys.map(
		(k) => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`,
	);
	return `{${parts.join(",")}}`;
}

function defaultGenerateKey(toolName: string, params: unknown): string {
	return `memo:${toolName}:${stableStringify(params)}`;
}

function isSerializable(value: unknown): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === "boolean" || typeof value === "number" || typeof value === "string")
		return true;
	if (value instanceof Blob || value instanceof ReadableStream) return false;
	if (typeof value === "object") {
		try {
			JSON.stringify(value);
			return true;
		} catch {
			return false;
		}
	}
	return false;
}

function debugLog(debug: MemoDebugOptions | undefined, message: string): void {
	if (debug?.enabled) {
		const logger = debug.logger ?? console.log;
		logger(message);
	}
}

export type MemoFn = <T extends Tool>(
	wrappedTool: T,
	toolName: string,
	config?: MemoToolConfig,
) => MemoizedTool<T>;

/**
 * creteMemo is a higher-order function that generates memoized versions of AI tools.
 *
 * @example
 * ```ts
 * const memo = createMemo({ storage: myStorage, ttl: 60000 });
 * const memoizedTool = memo(myTool, "myTool");
 * ```
 * @param options
 * @returns
 */
export function createMemo(options: MemoOptions): MemoFn {
	const { storage, hooks, debug } = options;

	return function memo<T extends Tool>(
		wrappedTool: T,
		toolName: string,
		config?: MemoToolConfig,
	): MemoizedTool<T> {
		const ttl = config?.ttl ?? options.ttl;
		const maxSize = config?.maxSize ?? options.maxSize;
		const shouldCache = config?.shouldCache ?? options.shouldCache;
		const generateKey = config?.generateKey ?? options.generateKey ?? defaultGenerateKey;

		async function getCacheEntry(key: string) {
			try {
				const raw = await storage.getItem(key);
				if (raw == null) return null;
				const entry = raw as CacheEntry<ToolOutput<T>>;
				if (!entry.metadata?.timestamp) return null;
				return entry;
			} catch (error) {
				debugLog(debug, `[memo] Error reading cache key="${key}": ${error}`);
				hooks?.onError?.(toolName, key, error);
				return null;
			}
		}

		async function setCacheEntry(key: string, value: ToolOutput<T>): Promise<void> {
			const entry: CacheEntry<ToolOutput<T>> = {
				value,
				metadata: { timestamp: Date.now() },
			};
			await storage.setItem(key, entry, {
				// some storage engines support TTL natively.
				ttl,
			});
		}

		const memoizedTool = {
			...wrappedTool,
			execute: async (args: ToolInput<T>, execOptions: ToolExecutionOptions) => {
				const key = generateKey(toolName, args);
				debugLog(debug, `[memo] execute tool="${toolName}" key="${key}"`);

				// Check shouldCache
				if (shouldCache && !shouldCache(toolName, args)) {
					debugLog(debug, "[memo] shouldCache=false, executing directly");
					if (wrappedTool.execute) {
						return wrappedTool.execute(args, execOptions);
					}
					throw new Error(`Tool "${toolName}" has no execute method`);
				}

				// Try cache
				const cached = await getCacheEntry(key);
				if (cached) {
					// Check TTL
					if (ttl != null) {
						const age = Date.now() - cached.metadata.timestamp;
						if (age > ttl) {
							debugLog(debug, `[memo] TTL expired (age=${age}ms, ttl=${ttl}ms)`);
							hooks?.onMiss?.(toolName, args);
						} else {
							debugLog(debug, "[memo] cache hit");
							hooks?.onHit?.(toolName, args, cached);
							const deserialized = options.deserializeValue
								? options.deserializeValue(cached.value, toolName, args)
								: cached.value;
							return deserialized as ToolOutput<T>;
						}
					} else {
						debugLog(debug, "[memo] cache hit (no TTL)");
						hooks?.onHit?.(toolName, args, cached);
						const deserialized = options.deserializeValue
							? options.deserializeValue(cached.value, toolName, args)
							: cached.value;
						return deserialized as ToolOutput<T>;
					}
				} else {
					debugLog(debug, "[memo] cache miss");
					hooks?.onMiss?.(toolName, args);
				}

				// Execute tool
				if (!wrappedTool.execute) {
					throw new Error(`Tool "${toolName}" has no execute method`);
				}
				const result = await wrappedTool.execute(args, execOptions);

				// Check if result is serializable (streams/blobs are not)
				if (!isSerializable(result)) {
					debugLog(debug, "[memo] result not serializable, skipping cache");
					return result;
				}

				// Check maxSize
				if (maxSize != null) {
					const serialized = JSON.stringify(result);
					if (serialized.length > maxSize) {
						debugLog(debug, `[memo] result exceeds maxSize (${serialized.length} > ${maxSize})`);
						return result;
					}
				}

				// Serialize if needed
				const toStore = options.serializeValue
					? (options.serializeValue(result, toolName, args) as ToolOutput<T>)
					: result;

				await setCacheEntry(key, toStore);
				debugLog(debug, "[memo] stored in cache");
				hooks?.onStore?.(toolName, args, result);

				return result;
			},

			// utils for manual cache management
			get: async (key: string) => getCacheEntry(key),
			set: async (key: string, value: ToolOutput<T>) => setCacheEntry(key, value),
			update: async (key: string, value: ToolOutput<T>) => setCacheEntry(key, value),
			delete: async (key: string) => {
				await storage.removeItem(key);
			},
		};

		return memoizedTool as MemoizedTool<T>;
	};
}
