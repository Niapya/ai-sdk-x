import { describe, expect, it } from "bun:test";
import { type CommandContext, EMPTY_BYTES, encodeUtf8ToBytes, InMemoryFs } from "just-bash";
import { createMemoryFeature } from "@/features/memory";

const HOME = "/home/user";

describe("createMemoryFeature", () => {
	it("returns stable helper props when disabled", () => {
		const feature = createMemoryFeature(false);

		expect(feature.name).toBe("memory");
		expect(feature.description).toBeUndefined();
		expect(feature.command).toBeUndefined();
		expect(feature.hooks).toBeUndefined();
		expect(feature.createCommand().name).toBe("x-memory");
		expect(typeof feature.add).toBe("function");
		expect(typeof feature.delete).toBe("function");
		expect(typeof feature.get).toBe("function");
		expect(typeof feature.init).toBe("function");
		expect(typeof feature.list).toBe("function");
		expect(typeof feature.search).toBe("function");
		expect(typeof feature.status).toBe("function");
		expect(typeof feature.update).toBe("function");
	});

	it("exposes note as its own subcommand", async () => {
		const feature = createMemoryFeature(false);
		const help = await feature.createCommand().execute(["--help"], {
			bash: null,
			command: null,
			metadata: {},
		} as never);

		expect(help.exitCode).toBe(0);
		expect(help.stdout).toContain("note - Add a daily memory entry.");
	});

	it("describes bash usage and stdin guidance when enabled", async () => {
		const feature = createMemoryFeature(true);
		const text = await feature.description?.({} as never);

		expect(text).toContain("not as a separate callable tool");
		expect(text).toContain('command="x-memory add note-title" with stdin="note body"');
	});

	it("binds helper methods to the configured mount point", async () => {
		const fs = new InMemoryFs();
		const feature = createMemoryFeature({
			mountPoint: "/notes",
		});
		const ctx = createContext(fs, "remember this");

		const addResult = await feature.add(
			{
				title: "Test Note",
			},
			ctx,
		);

		expect(addResult.exitCode).toBe(0);
		expect(addResult.stdout).toContain(":Test Note");

		const listResult = await feature.list(fs);
		expect(listResult.exitCode).toBe(0);
		expect(listResult.stdout).toContain("Test Note");

		const searchResult = await feature.search("remember", fs);
		expect(searchResult.exitCode).toBe(0);
		expect(searchResult.stdout).toContain("Test Note");
		expect(searchResult.stdout).toContain("remember this");

		const statusResult = await feature.status(fs);
		expect(statusResult.stdout).toContain("entries\t1");
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
