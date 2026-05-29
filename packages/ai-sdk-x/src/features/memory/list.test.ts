import { describe, expect, it } from "bun:test";
import { InMemoryFs } from "just-bash";
import { listMemory } from "@/features/memory/list";

const MOUNT = "/home/user/memory";

describe("listMemory", () => {
	it("returns empty stdout when memory.json does not exist", async () => {
		const fs = new InMemoryFs();
		const result = await listMemory(fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});

	it("lists indexed entries sorted by date and title", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/memory.json`]: JSON.stringify({
				version: 1,
				daily: {
					"2025-06-02": {
						Beta: {
							description: "second",
							keywords: ["b"],
							createAt: 2,
							updateAt: 2,
						},
					},
					"2025-06-01": {
						Alpha: {
							description: "first",
							keywords: ["a"],
							createAt: 1,
							updateAt: 1,
						},
					},
				},
			}),
		});
		const result = await listMemory(fs, { mountPoint: MOUNT });

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("2025-06-01\tAlpha\tfirst [a]\n2025-06-02\tBeta\tsecond [b]\n");
	});

	it("returns empty stdout when index exists but is empty", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/memory.json`]: '{"version":1,"daily":{}}\n',
		});
		const result = await listMemory(fs, { mountPoint: MOUNT });
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("");
	});
});
