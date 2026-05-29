import { describe, expect, it } from "bun:test";
import { type CommandContext, EMPTY_BYTES, encodeUtf8ToBytes, InMemoryFs } from "just-bash";
import { deleteMemory } from "@/features/memory/delete";
import { getMemory } from "@/features/memory/get";
import { initMemory } from "@/features/memory/init";
import { statusMemory } from "@/features/memory/status";
import { updateMemory } from "@/features/memory/update";

const HOME = "/home/user";
const MOUNT = "/home/user/memory";

function makeCtx(stdin: string, fs: InMemoryFs): CommandContext {
	return {
		cwd: HOME,
		env: new Map([["HOME", HOME]]),
		fs,
		stdin: stdin ? encodeUtf8ToBytes(stdin) : EMPTY_BYTES,
	};
}

describe("memory index commands", () => {
	it("initializes memory.json", async () => {
		const fs = new InMemoryFs();
		const result = await initMemory(makeCtx("", fs), { mountPoint: MOUNT });

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe(`${MOUNT}/memory.json\n`);
		expect(await fs.readFile(`${MOUNT}/memory.json`)).toBe(
			'{\n  "version": 1,\n  "daily": {}\n}\n',
		);
	});

	it("gets, updates, reports, and deletes indexed entries", async () => {
		const fs = new InMemoryFs({
			[`${MOUNT}/memory.json`]: JSON.stringify({
				version: 1,
				daily: {
					"2025-06-01": {
						Note: {
							description: "before",
							keywords: ["old"],
							createAt: 1,
							updateAt: 1,
						},
					},
				},
			}),
		});

		const getResult = await getMemory("2025-06-01:Note", fs, { mountPoint: MOUNT });
		expect(getResult.stdout).toContain('"description": "before"');

		const updateResult = await updateMemory(
			{ keywords: ["new"], ref: "2025-06-01:Note" },
			makeCtx("after", fs),
			{ mountPoint: MOUNT },
		);
		expect(updateResult.exitCode).toBe(0);

		const updated = JSON.parse(await fs.readFile(`${MOUNT}/memory.json`));
		expect(updated.daily["2025-06-01"].Note.description).toBe("after");
		expect(updated.daily["2025-06-01"].Note.keywords).toEqual(["new"]);
		expect(updated.daily["2025-06-01"].Note.createAt).toBe(1);

		const statusResult = await statusMemory(fs, { mountPoint: MOUNT });
		expect(statusResult.stdout).toContain("entries\t1");
		expect(statusResult.stdout).toContain("dates\t1");

		const deleteResult = await deleteMemory("2025-06-01:Note", makeCtx("", fs), {
			mountPoint: MOUNT,
		});
		expect(deleteResult.exitCode).toBe(0);

		const afterDelete = JSON.parse(await fs.readFile(`${MOUNT}/memory.json`));
		expect(afterDelete.daily).toEqual({});
	});
});
