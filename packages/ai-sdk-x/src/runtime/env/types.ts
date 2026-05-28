import type { Awaitable } from "@/types";

/**
 * Serializable process-like runtime state that survives across command executions.
 */
export interface EnvSnapshot {
	cwd: string;
	env: Record<string, string>;
}

/**
 * Persistence adapter used by X to load and save shell cwd/env snapshots.
 */
export interface EnvBackend {
	load(): Awaitable<EnvSnapshot | null>;
	save(snapshot: EnvSnapshot): Awaitable<void>;
}
