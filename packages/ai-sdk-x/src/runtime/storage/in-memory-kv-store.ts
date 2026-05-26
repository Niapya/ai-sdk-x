import type { KVStorage } from "@/types/storage";

/**
 * Options for the default in-memory KV store used by runtime wrappers.
 */
export interface InMemoryKVStoreOptions {
	now?: () => number;
}

interface KvEntry {
	expiresAt: null | number;
	updatedAt: number;
	value: string;
}

export class InMemoryKVStore implements KVStorage {
	private readonly entries = new Map<string, KvEntry>();
	private readonly now: () => number;

	/**
	 * Create an in-memory KV store with optional clock injection for tests.
	 */
	constructor(options: InMemoryKVStoreOptions = {}) {
		this.now = options.now ?? Date.now;
	}

	/**
	 * List stored keys, optionally filtered by prefix and capped by limit.
	 */
	async list(prefix?: string, limit?: number): Promise<string[]> {
		this.purgeExpired();
		const values = Array.from(this.entries.keys())
			.filter((key) => (prefix ? key.startsWith(prefix) : true))
			.sort();

		return typeof limit === "number" ? values.slice(0, limit) : values;
	}

	/**
	 * Read a value, lazily purging it when the TTL has expired.
	 */
	async get(key: string): Promise<null | string> {
		const entry = this.entries.get(key);
		if (!entry) {
			return null;
		}

		if (this.isExpired(entry)) {
			this.entries.delete(key);
			return null;
		}

		return entry.value;
	}

	/**
	 * Store a value with an optional TTL in milliseconds.
	 */
	async set(key: string, value: string, ttl?: number): Promise<void> {
		const now = this.now();
		this.entries.set(key, {
			value,
			updatedAt: now,
			expiresAt: ttl && ttl > 0 ? now + ttl : null,
		});
	}

	/**
	 * Remove a key from the store.
	 */
	async delete(key: string): Promise<void> {
		this.entries.delete(key);
	}

	private purgeExpired(): void {
		for (const [key, entry] of this.entries) {
			if (this.isExpired(entry)) {
				this.entries.delete(key);
			}
		}
	}

	private isExpired(entry: KvEntry): boolean {
		return entry.expiresAt !== null && entry.expiresAt <= this.now();
	}
}
