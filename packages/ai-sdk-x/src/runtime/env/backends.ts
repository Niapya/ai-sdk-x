import { cloneEnv } from "@/runtime/env/safe-env";
import type { EnvBackend, EnvSnapshot } from "@/runtime/env/types";
import { InMemoryKVStore } from "@/runtime/storage";
import type { KVStorage } from "@/types";

interface RawEnvSnapshot {
	cwd: string;
	env: Record<string, unknown>;
}

/**
 * In-process env persistence backend for tests and single-session runtimes.
 */
export class MemoryEnvBackend implements EnvBackend {
	#snapshot: EnvSnapshot | null;

	constructor(snapshot?: EnvSnapshot) {
		this.#snapshot = snapshot ? sanitizeSnapshot(snapshot) : null;
	}

	load(): EnvSnapshot | null {
		return this.#snapshot ? sanitizeSnapshot(this.#snapshot) : null;
	}

	save(snapshot: EnvSnapshot): void {
		this.#snapshot = sanitizeSnapshot(snapshot);
	}
}

/**
 * Options for the KV-backed env backend.
 */
export interface KvEnvBackendOptions {
	kv?: KVStorage;
	key?: string;
}

/**
 * Env backend that stores a sanitized snapshot as JSON in a KV store.
 */
export class KvEnvBackend implements EnvBackend {
	private readonly key: string;
	private readonly kv: KVStorage;

	constructor(options: KvEnvBackendOptions = {}) {
		this.kv = options.kv ?? new InMemoryKVStore();
		this.key = options.key ?? "ai-sdk-x:env-snapshot";
	}

	async load(): Promise<EnvSnapshot | null> {
		const raw = await this.kv.get(this.key);
		if (!raw) return null;

		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return null;
		}

		if (!isPlainRecord(parsed)) return null;
		const obj = parsed;
		if (typeof obj.cwd !== "string") return null;
		if (!isPlainRecord(obj.env)) return null;

		return sanitizeSnapshot({
			cwd: obj.cwd,
			env: obj.env,
		});
	}

	async save(snapshot: EnvSnapshot): Promise<void> {
		await this.kv.set(this.key, JSON.stringify(sanitizeSnapshot(snapshot)));
	}
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeSnapshot(snapshot: RawEnvSnapshot): EnvSnapshot {
	return {
		cwd: snapshot.cwd || "/home/user",
		env: cloneEnv(snapshot.env),
	};
}
