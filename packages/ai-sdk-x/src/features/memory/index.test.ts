import { describe, expect, it } from "bun:test";
import { type CommandContext, EMPTY_BYTES, encodeUtf8ToBytes, InMemoryFs } from "just-bash";
import { createMemoryFeature } from "@/features/memory";

const HOME = "/home/user";

describe("createMemoryFeature", () => {
	it("returns stable helper props when disabled", () => {
		const feature = createMemoryFeature(false);

		expect(feature.name).toBe("memory");
		expect(feature.prompt).toBeUndefined();
		expect(feature.command).toBeUndefined();
		expect(feature.hooks).toBeUndefined();
		expect(feature.createCommand().name).toBe("x-memory");
		expect(typeof feature.add).toBe("function");
		expect(typeof feature.list).toBe("function");
		expect(typeof feature.search).toBe("function");
	});

	it("binds helper methods to the configured mount point", async () => {
		const fs = new InMemoryFs();
		const feature = createMemoryFeature({
			mountPoint: "/notes",
		});
		const ctx = createContext(fs, "remember this");

		const addResult = await feature.add(
			{
				longTerm: false,
				title: "Test Note",
			},
			ctx,
		);

		expect(addResult.exitCode).toBe(0);
		expect(addResult.stdout).toContain("/notes/daily/");

		const listResult = await feature.list(fs);
		expect(listResult.exitCode).toBe(0);
		expect(listResult.stdout).toContain("/notes/daily/");

		const searchResult = await feature.search("remember", fs);
		expect(searchResult.exitCode).toBe(0);
		expect(searchResult.stdout).toContain("/notes/daily/");
		expect(searchResult.stdout).toContain("remember this");
	});
});

function createContext(fs: InMemoryFs, stdin?: string): CommandContext {
	return {
		cwd: HOME,
		env: new Map([["HOME", HOME]]),
		fs,
		stdin: stdin ? encodeUtf8ToBytes(stdin) : EMPTY_BYTES,
	};
}
