import { describe, expect, it } from "bun:test";
import { InMemoryFs } from "just-bash";
import {
	initLockfile,
	readLockfile,
	resolveTokenPath,
	toTokenPath,
	writeLockfile,
} from "@/utils/lockfile";

interface TestIndex {
	items: string[];
	version: 1;
}

const createEmpty = (): TestIndex => ({ version: 1, items: [] });

function isTestIndex(value: unknown): value is TestIndex {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const version = Object.getOwnPropertyDescriptor(value, "version")?.value;
	const items = Object.getOwnPropertyDescriptor(value, "items")?.value;
	return version === 1 && Array.isArray(items) && items.every((item) => typeof item === "string");
}

function options(fs: InMemoryFs) {
	return {
		createEmpty,
		filename: "index.json",
		fs,
		isValid: isTestIndex,
		mountPoint: "/store",
	};
}

describe("lockfile utils", () => {
	it("returns an empty value when the lockfile is missing", async () => {
		const fs = new InMemoryFs();

		expect(await readLockfile(options(fs))).toEqual({ version: 1, items: [] });
	});

	it("returns an empty value for invalid JSON or invalid structure", async () => {
		const fs = new InMemoryFs({
			"/store/bad-json.json": "{",
			"/store/bad-shape.json": JSON.stringify({ version: 2, items: ["x"] }),
		});

		expect(
			await readLockfile({
				...options(fs),
				filename: "bad-json.json",
			}),
		).toEqual(createEmpty());
		expect(
			await readLockfile({
				...options(fs),
				filename: "bad-shape.json",
			}),
		).toEqual(createEmpty());
	});

	it("returns parsed lockfile values when a parser is provided", async () => {
		const fs = new InMemoryFs({
			"/store/index.json": JSON.stringify({ extra: true, items: ["a"], version: 1 }),
		});

		const value = await readLockfile({
			createEmpty,
			filename: "index.json",
			fs,
			mountPoint: "/store",
			parse(input) {
				if (isTestIndex(input)) {
					return { version: input.version, items: input.items };
				}
				return undefined;
			},
		});

		expect(value).toEqual({ version: 1, items: ["a"] });
	});

	it("writes formatted JSON and ensures the mount directory exists", async () => {
		const fs = new InMemoryFs();

		await writeLockfile(options(fs), { version: 1, items: ["a", "b"] });

		expect(await fs.readFile("/store/index.json")).toBe(
			'{\n  "version": 1,\n  "items": [\n    "a",\n    "b"\n  ]\n}\n',
		);
	});

	it("initializes by reading, running setup, and writing the current value", async () => {
		const fs = new InMemoryFs();
		let setupRan = false;

		const value = await initLockfile(options(fs), async () => {
			setupRan = true;
			await fs.writeFile("/store/core.txt", "");
		});

		expect(value).toEqual(createEmpty());
		expect(setupRan).toBe(true);
		expect(await fs.exists("/store/core.txt")).toBe(true);
		expect(await fs.exists("/store/index.json")).toBe(true);
	});

	it("converts token-prefixed paths to and from mount paths", () => {
		const fs = new InMemoryFs();

		expect(resolveTokenPath(fs, "/store", "$STORE_HOME", "$STORE_HOME")).toBe("/store");
		expect(resolveTokenPath(fs, "/store", "$STORE_HOME", "$STORE_HOME/docs/a.md")).toBe(
			"/store/docs/a.md",
		);
		expect(resolveTokenPath(fs, "/store", "$STORE_HOME", "/outside/a.md")).toBe("/outside/a.md");

		expect(toTokenPath(fs, "/store", "$STORE_HOME", "/store")).toBe("$STORE_HOME");
		expect(toTokenPath(fs, "/store", "$STORE_HOME", "/store/docs/a.md")).toBe(
			"$STORE_HOME/docs/a.md",
		);
		expect(toTokenPath(fs, "/store", "$STORE_HOME", "/store-other/a.md")).toBe("/store-other/a.md");
	});
});
