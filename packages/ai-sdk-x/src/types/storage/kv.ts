import type { Awaitable } from "..";

export interface KVStorage {
	list: (prefix?: string, limit?: number) => Awaitable<string[]>;
	get: (key: string) => Awaitable<null | string | undefined>;
	set: (key: string, value: string, ttl?: number) => Awaitable<void>;
	delete: (key: string) => Awaitable<void>;
}
