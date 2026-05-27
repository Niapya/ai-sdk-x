import { describe, expect, it } from "bun:test";
import {
	createEnvironment,
	MemoryEnvironment,
	persistEnvironmentSnapshot,
	resolveEnvironmentSnapshot,
} from "@/runtime/environment";

describe("MemoryEnvironment", () => {
	it("returns a snapshot copy of the stored env", () => {
		const env = new MemoryEnvironment({ FOO: "bar", BAZ: "qux" });
		const snapshot = env.get();
		expect(snapshot).toEqual({ FOO: "bar", BAZ: "qux" });
	});

	it("mutations to the returned object do not affect internal state", () => {
		const env = new MemoryEnvironment({ FOO: "original" });
		const snapshot = env.get();
		snapshot.FOO = "mutated";
		expect(env.get().FOO).toBe("original");
	});

	it("set replaces the entire stored env", () => {
		const env = new MemoryEnvironment({ A: "1", B: "2" });
		env.set({ C: "3" });
		expect(env.get()).toEqual({ C: "3" });
	});

	it("set stores a copy, further mutations to the arg do not affect state", () => {
		const env = new MemoryEnvironment();
		const input = { X: "1" };
		env.set(input);
		input.X = "mutated";
		expect(env.get().X).toBe("1");
	});

	it("starts with empty env when constructed with no args", () => {
		const env = new MemoryEnvironment();
		expect(env.get()).toEqual({});
	});
});

describe("createEnvironment", () => {
	it("returns a MemoryEnvironment when no argument is provided", () => {
		const env = createEnvironment();
		expect(typeof env.get).toBe("function");
		expect(typeof env.set).toBe("function");
		expect(env.get()).toEqual({});
	});

	it("returns the provided environment instance unchanged", () => {
		const custom = new MemoryEnvironment({ MY: "val" });
		const env = createEnvironment(custom);
		expect(env).toBe(custom);
	});
});

describe("resolveEnvironmentSnapshot", () => {
	it("merges currentEnv and initialEnv, initialEnv keys take priority", async () => {
		const env = new MemoryEnvironment({ USER_VAR: "user", SHARED: "user-value" });
		const initialEnv = { SHARED: "initial-wins", EXTRA: "extra" };
		const result = await resolveEnvironmentSnapshot(env, initialEnv);
		expect(result).toEqual({
			USER_VAR: "user",
			SHARED: "initial-wins",
			EXTRA: "extra",
		});
	});

	it("returns only initialEnv when currentEnv is empty", async () => {
		const env = new MemoryEnvironment();
		const result = await resolveEnvironmentSnapshot(env, { FOO: "bar" });
		expect(result).toEqual({ FOO: "bar" });
	});

	it("returns only currentEnv when initialEnv is empty", async () => {
		const env = new MemoryEnvironment({ A: "1" });
		const result = await resolveEnvironmentSnapshot(env, {});
		expect(result).toEqual({ A: "1" });
	});

	it("handles both empty env and empty initialEnv", async () => {
		const env = new MemoryEnvironment();
		const result = await resolveEnvironmentSnapshot(env, {});
		expect(result).toEqual({});
	});
});

describe("persistEnvironmentSnapshot", () => {
	it("removes initialEnv keys from nextEnv before persisting", async () => {
		const env = new MemoryEnvironment();
		const initialEnv = { HOME: "/home/user", FEATURE_VAR: "feature" };
		const nextEnv = { HOME: "/home/user", FEATURE_VAR: "feature", USER_ADDED: "yes" };
		await persistEnvironmentSnapshot(env, initialEnv, nextEnv);
		expect(env.get()).toEqual({ USER_ADDED: "yes" });
	});

	it("persists empty object when nextEnv only contains initialEnv keys", async () => {
		const env = new MemoryEnvironment({ EXISTING: "old" });
		await persistEnvironmentSnapshot(env, { A: "1", B: "2" }, { A: "1", B: "2" });
		expect(env.get()).toEqual({});
	});

	it("persists all of nextEnv when initialEnv is empty", async () => {
		const env = new MemoryEnvironment();
		await persistEnvironmentSnapshot(env, {}, { FOO: "bar", BAZ: "qux" });
		expect(env.get()).toEqual({ FOO: "bar", BAZ: "qux" });
	});

	it("does not mutate the nextEnv object passed in", async () => {
		const env = new MemoryEnvironment();
		const nextEnv = { INIT_KEY: "val", EXTRA: "keep" };
		const original = { ...nextEnv };
		await persistEnvironmentSnapshot(env, { INIT_KEY: "val" }, nextEnv);
		expect(nextEnv).toEqual(original);
	});

	it("handles key present in initialEnv but absent in nextEnv", async () => {
		const env = new MemoryEnvironment();
		const initialEnv = { GONE: "was-here" };
		const nextEnv = { STAYED: "here" };
		await persistEnvironmentSnapshot(env, initialEnv, nextEnv);
		// GONE is in initialEnv but not nextEnv – delete is a no-op; STAYED is kept
		expect(env.get()).toEqual({ STAYED: "here" });
	});

	it("replaces previously stored env on each persist call", async () => {
		const env = new MemoryEnvironment({ PREV: "old" });
		await persistEnvironmentSnapshot(env, {}, { NEW: "value" });
		// set() replaces, so PREV is gone
		expect(env.get()).toEqual({ NEW: "value" });
	});
});
