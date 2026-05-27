import { describe, expect, it } from "bun:test";
import { InMemoryKVStore } from "@/runtime/storage/in-memory-kv-store";

describe("InMemoryKVStore", () => {
	it("stores, lists, limits, and deletes keys", async () => {
		const store = new InMemoryKVStore();

		await store.set("skills:alpha", "a");
		await store.set("skills:beta", "b");
		await store.set("memory:one", "c");

		expect(await store.get("skills:alpha")).toBe("a");
		expect(await store.list("skills:")).toEqual(["skills:alpha", "skills:beta"]);
		expect(await store.list("skills:", 1)).toEqual(["skills:alpha"]);

		await store.delete("skills:alpha");
		expect(await store.get("skills:alpha")).toBeNull();
	});

	it("expires keys by ttl on get and list", async () => {
		let now = 0;
		const store = new InMemoryKVStore({ now: () => now });

		await store.set("a", "1", 10);
		await store.set("b", "2", 50);

		expect(await store.get("a")).toBe("1");
		now = 20;
		expect(await store.get("a")).toBeNull();
		expect(await store.list()).toEqual(["b"]);
	});
});

describe("InMemoryKVStore – additional edge cases", () => {
	it("returns null for a key that was never set", async () => {
		const store = new InMemoryKVStore();
		expect(await store.get("nonexistent")).toBeNull();
	});

	it("list with no prefix returns all keys sorted", async () => {
		const store = new InMemoryKVStore();
		await store.set("z", "1");
		await store.set("a", "2");
		await store.set("m", "3");
		expect(await store.list()).toEqual(["a", "m", "z"]);
	});

	it("list with no matching prefix returns empty array", async () => {
		const store = new InMemoryKVStore();
		await store.set("other:key", "val");
		expect(await store.list("skills:")).toEqual([]);
	});

	it("delete removes the key and get returns null afterwards", async () => {
		const store = new InMemoryKVStore();
		await store.set("key", "val");
		await store.delete("key");
		expect(await store.get("key")).toBeNull();
	});

	it("delete on non-existent key is a no-op", async () => {
		const store = new InMemoryKVStore();
		await expect(store.delete("ghost")).resolves.toBeUndefined();
	});

	it("overwrite an existing key with a new value", async () => {
		const store = new InMemoryKVStore();
		await store.set("k", "old");
		await store.set("k", "new");
		expect(await store.get("k")).toBe("new");
	});

	it("set without TTL never expires", async () => {
		let now = 0;
		const store = new InMemoryKVStore({ now: () => now });
		await store.set("permanent", "value");
		now = Number.MAX_SAFE_INTEGER;
		expect(await store.get("permanent")).toBe("value");
	});

	it("list limit=0 returns an empty array", async () => {
		const store = new InMemoryKVStore();
		await store.set("a", "1");
		expect(await store.list(undefined, 0)).toEqual([]);
	});

	it("expired keys do not appear in list even without prefix", async () => {
		let now = 0;
		const store = new InMemoryKVStore({ now: () => now });
		await store.set("exp", "val", 5);
		await store.set("live", "val2", 100);
		now = 10;
		const keys = await store.list();
		expect(keys).not.toContain("exp");
		expect(keys).toContain("live");
	});
});
