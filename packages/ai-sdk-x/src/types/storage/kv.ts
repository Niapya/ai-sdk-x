import type { Awaitable } from "..";

export interface KVStorage {
	get: (key: string) => Awaitable<unknown>;
	set: (key: string, value: string, ttl?: number) => Awaitable<undefined | null | unknown>;
	delete: (key: string) => Awaitable<undefined | null | string>;
}
