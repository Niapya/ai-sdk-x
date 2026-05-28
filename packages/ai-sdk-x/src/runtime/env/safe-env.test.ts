import { describe, expect, it } from "bun:test";
import { cloneEnv, KvEnvBackend, MemoryEnvBackend, mergeEnv } from "@/runtime/env";
import { InMemoryKVStore } from "@/runtime/storage";

describe("runtime env helpers", () => {
	it("mergeEnv returns a null-prototype record with later values winning", () => {
		const env = mergeEnv({ A: "1", SHARED: "first" }, { B: "2", SHARED: "second" });
		expect(Object.getPrototypeOf(env)).toBeNull();
		expect(env).toMatchObject({
			A: "1",
			B: "2",
			SHARED: "second",
		});
	});

	it("cloneEnv blocks prototype pollution keys", () => {
		const input = Object.fromEntries([
			["__proto__", { polluted: "yes" } as unknown as string],
			["constructor", "bad"],
			["prototype", "bad"],
			["SAFE", "ok"],
		]) as Record<string, string>;

		const env = cloneEnv(input);

		expect(env.SAFE).toBe("ok");
		expect(env.__proto__).toBeUndefined();
		expect(({} as { polluted?: string }).polluted).toBeUndefined();
	});

	it("cloneEnv and mergeEnv drop non-string values", () => {
		const env = mergeEnv({ SAFE: "ok", COUNT: 1 }, { NEXT: "yes", NIL: null });

		expect(env).toMatchObject({ SAFE: "ok", NEXT: "yes" });
		expect("COUNT" in env).toBe(false);
		expect("NIL" in env).toBe(false);
	});
});

describe("runtime env backends", () => {
	it("MemoryEnvBackend returns cloned snapshots", () => {
		const backend = new MemoryEnvBackend({
			cwd: "/work",
			env: { A: "1" },
		});

		const first = backend.load();
		expect(first).toEqual({ cwd: "/work", env: { A: "1" } });
		if (!first) throw new Error("expected snapshot");
		first.cwd = "/mutated";
		first.env.A = "changed";

		expect(backend.load()).toEqual({ cwd: "/work", env: { A: "1" } });
	});

	it("KvEnvBackend sanitizes loaded snapshots and ignores malformed JSON", async () => {
		const kv = new InMemoryKVStore();
		const backend = new KvEnvBackend({ kv, key: "env" });

		await kv.set("env", "{bad json");
		expect(await backend.load()).toBeNull();

		await kv.set(
			"env",
			JSON.stringify({
				cwd: "",
				env: {
					SAFE: "ok",
					COUNT: 1,
					constructor: "bad",
				},
			}),
		);

		const snapshot = await backend.load();
		expect(snapshot?.cwd).toBe("/home/user");
		expect(snapshot?.env).toMatchObject({ SAFE: "ok" });
		expect(snapshot?.env.constructor).toBeUndefined();
		expect("COUNT" in (snapshot?.env ?? {})).toBe(false);
	});

	it("KvEnvBackend saves sanitized snapshots", async () => {
		const kv = new InMemoryKVStore();
		const backend = new KvEnvBackend({ kv, key: "env" });

		await backend.save({
			cwd: "/repo",
			env: Object.fromEntries([
				["A", "1"],
				["__proto__", "bad"],
			]) as Record<string, string>,
		});

		const raw = await kv.get("env");
		expect(raw).toBeTruthy();
		expect(JSON.parse(raw ?? "{}")).toEqual({
			cwd: "/repo",
			env: { A: "1" },
		});
	});
});
