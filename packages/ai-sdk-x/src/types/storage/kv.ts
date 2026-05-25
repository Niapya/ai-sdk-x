import type { Awaitable } from "..";

export interface KVStorage {
	get: (key: string) => Awaitable<null | string | undefined>;
	set: (key: string, value: string, ttl?: number) => Awaitable<void>;
	delete: (key: string) => Awaitable<void>;
}
