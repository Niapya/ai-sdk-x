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
