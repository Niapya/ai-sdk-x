import { describe, expect, it } from "bun:test";
import { InMemoryFs } from "just-bash";
import { searchMemory } from "@/features/memory/search";

const MOUNT = "/home/user/memory";

describe("searchMemory", () => {
	it("returns exitCode 1 for empty query", async () => {
		const fs = new InMemoryFs();
		const result = await searchMemory("", fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("missing query");
	});

	it("returns empty stdout when no indexed entries match", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/memory.json`]: JSON.stringify({
				version: 1,
				daily: {
					"2025-06-01": {
						Note: {
							description: "some content here",
							keywords: [],
							createAt: 1,
							updateAt: 1,
						},
					},
				},
			}),
		});
		const result = await searchMemory("zzz-no-match", fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});

	it("matches case-insensitively across title, description, and keywords", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/memory.json`]: JSON.stringify({
				version: 1,
				daily: {
					"2025-06-01": {
						Greeting: {
							description: "Hello World",
							keywords: ["ProjectX"],
							createAt: 1,
							updateAt: 1,
						},
					},
				},
			}),
		});

		const descriptionResult = await searchMemory("hello world", fs, { mountPoint: MOUNT });
		expect(descriptionResult.stdout).toContain("2025-06-01:Greeting\tHello World");

		const keywordResult = await searchMemory("projectx", fs, { mountPoint: MOUNT });
		expect(keywordResult.stdout).toContain("2025-06-01:Greeting\tHello World");
	});

	it("searches across multiple indexed entries", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/memory.json`]: JSON.stringify({
				version: 1,
				daily: {
					"2025-06-01": {
						First: {
							description: "found in first",
							keywords: [],
							createAt: 1,
							updateAt: 1,
						},
					},
					"2025-06-02": {
						Second: {
							description: "found in second",
							keywords: [],
							createAt: 2,
							updateAt: 2,
						},
					},
				},
			}),
		});

		const result = await searchMemory("found", fs, { mountPoint: MOUNT });
		expect(result.stdout).toContain("2025-06-01:First");
		expect(result.stdout).toContain("2025-06-02:Second");
		expect(result.stdout.endsWith("\n")).toBe(true);
	});
});
