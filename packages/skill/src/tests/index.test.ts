import { describe, expect, mock, spyOn, test } from "bun:test";

mock.module("ai", () => ({
	tool: (opts: Record<string, unknown>) => opts,
}));

import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import type { SkillDetail, SkillIndex, SkillMeta } from "../index";
import { createSkill } from "../index";

const toolExecOpts = { toolCallId: "test", messages: [] };

function makeDetail(name: string, description = `${name} description`): SkillDetail {
	return {
		name,
		description,
		version: "1.0.0",
		gitURL: `https://github.com/test/${name}`,
	};
}

describe("createSkill", () => {
	test("returns a function", () => {
		const storage = createStorage({ driver: memoryDriver() });
		const skill = createSkill({
			storage,
			download: async () => [],
			get: async () => null,
		});
		expect(typeof skill).toBe("function");
	});

	test("returned function creates a SkillInstance", () => {
		const storage = createStorage({ driver: memoryDriver() });
		const skill = createSkill({
			storage,
			download: async () => [],
			get: async () => null,
		});
		const instance = skill();
		expect(typeof instance.list).toBe("function");
		expect(typeof instance.get).toBe("function");
		expect(typeof instance.download).toBe("function");
		expect(typeof instance.getTools).toBe("function");
	});

	describe("list()", () => {
		test("returns empty array initially", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
			});
			const instance = skill();
			const result = await instance.list();
			expect(result).toEqual([]);
		});

		test("returns skills after download", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const detail = makeDetail("test-skill");
			const skill = createSkill({
				storage,
				download: async () => [detail],
				get: async () => null,
			});
			const instance = skill();
			await instance.download("https://github.com/test/repo");
			const result = await instance.list();
			expect(result).toEqual([{ name: "test-skill", description: "test-skill description" }]);
		});
	});

	describe("get()", () => {
		test("returns skill detail when found", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const detail = makeDetail("test-skill");
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => detail,
			});
			const instance = skill();
			const result = await instance.get("test-skill");
			expect(result).toEqual(detail);
		});

		test("returns null for unknown skill", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
			});
			const instance = skill();
			const result = await instance.get("nonexistent");
			expect(result).toBeNull();
		});

		test("stores detail in storage when found", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const detail = makeDetail("test-skill");
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => detail,
			});
			const instance = skill();
			await instance.get("test-skill");
			const stored = await storage.getItem("skills:test-skill");
			expect(stored).toEqual(detail);
		});

		test("does not store in storage when detail is null", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
			});
			const instance = skill();
			await instance.get("nonexistent");
			const stored = await storage.getItem("skills:nonexistent");
			expect(stored).toBeNull();
		});
	});

	describe("download()", () => {
		test("downloads skills, stores details, and updates index", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const detail = makeDetail("new-skill");
			const skill = createSkill({
				storage,
				download: async () => [detail],
				get: async () => null,
			});
			const instance = skill();
			const result = await instance.download("https://github.com/test/repo");
			expect(result).toEqual([detail]);

			const stored = await storage.getItem("skills:new-skill");
			expect(stored).toEqual(detail);

			const index = await storage.getItem<SkillIndex>("skills");
			expect(index).toBeDefined();
			if (index) {
				expect(index.skills.length).toBe(1);
				expect(index.skills[0].name).toBe("new-skill");
				expect(index.updateTime).toBeGreaterThan(0);
			}
		});

		test("updates existing skill in index (findIndex >= 0)", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const detail1 = makeDetail("skill-a", "old description");
			const detail2 = makeDetail("skill-a", "new description");
			let callCount = 0;
			const skill = createSkill({
				storage,
				download: async () => {
					callCount++;
					return callCount === 1 ? [detail1] : [detail2];
				},
				get: async () => null,
			});
			const instance = skill();
			await instance.download("https://github.com/test/repo");
			await instance.download("https://github.com/test/repo");
			const list = await instance.list();
			expect(list).toEqual([{ name: "skill-a", description: "new description" }]);
			expect(list.length).toBe(1);
		});

		test("adds new skill to index (findIndex === -1)", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const skill = createSkill({
				storage,
				download: async (url) => {
					if (url.includes("repo1")) return [makeDetail("skill-a")];
					return [makeDetail("skill-b")];
				},
				get: async () => null,
			});
			const instance = skill();
			await instance.download("https://github.com/test/repo1");
			await instance.download("https://github.com/test/repo2");
			const list = await instance.list();
			expect(list.length).toBe(2);
			expect(list[0].name).toBe("skill-a");
			expect(list[1].name).toBe("skill-b");
		});

		test("handles multiple skills in single download", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const details = [makeDetail("skill-x"), makeDetail("skill-y"), makeDetail("skill-z")];
			const skill = createSkill({
				storage,
				download: async () => details,
				get: async () => null,
			});
			const instance = skill();
			const result = await instance.download("https://github.com/test/multi");
			expect(result.length).toBe(3);
			const list = await instance.list();
			expect(list.length).toBe(3);

			for (const detail of details) {
				const stored = await storage.getItem(`skills:${detail.name}`);
				expect(stored).toEqual(detail);
			}
		});
	});

	describe("getTools()", () => {
		test("returns listSkills, getSkill, downloadSkill tools", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
			});
			const instance = skill();
			const tools = await instance.getTools();
			expect(tools.listSkills).toBeDefined();
			expect(tools.getSkill).toBeDefined();
			expect(tools.downloadSkill).toBeDefined();
		});

		test("listSkills.execute works", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
			});
			const instance = skill();
			const tools = await instance.getTools();
			if (tools.listSkills.execute) {
				const result = await tools.listSkills.execute(undefined, toolExecOpts);
				expect(result).toEqual([]);
			}
		});

		test("getSkill.execute works", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const detail = makeDetail("test-skill");
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => detail,
			});
			const instance = skill();
			const tools = await instance.getTools();
			if (tools.getSkill.execute) {
				const result = await tools.getSkill.execute({ name: "test-skill" }, toolExecOpts);
				expect(result).toEqual(detail);
			}
		});

		test("downloadSkill.execute works", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const detail = makeDetail("test-skill");
			const skill = createSkill({
				storage,
				download: async () => [detail],
				get: async () => null,
			});
			const instance = skill();
			const tools = await instance.getTools();
			if (tools.downloadSkill.execute) {
				const result = await tools.downloadSkill.execute(
					{ url: "https://github.com/test/repo" },
					toolExecOpts,
				);
				expect(result).toEqual([detail]);
			}
		});
	});

	describe("hooks", () => {
		test("onList is called", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const listed: SkillMeta[][] = [];
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
				hooks: {
					onList: (skills) => listed.push(skills),
				},
			});
			const instance = skill();
			await instance.list();
			expect(listed.length).toBe(1);
			expect(listed[0]).toEqual([]);
		});

		test("onGet is called", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const getCalls: Array<{ name: string; detail: SkillDetail | null }> = [];
			const skillDetail = makeDetail("my-skill");
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => skillDetail,
				hooks: {
					onGet: (name, detail) => getCalls.push({ name, detail }),
				},
			});
			const instance = skill();
			await instance.get("my-skill");
			expect(getCalls.length).toBe(1);
			expect(getCalls[0].name).toBe("my-skill");
			expect(getCalls[0].detail).toEqual(skillDetail);
		});

		test("onDownload is called", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const downloadedURLs: string[] = [];
			const skill = createSkill({
				storage,
				download: async () => [makeDetail("skill-a")],
				get: async () => null,
				hooks: {
					onDownload: (url) => downloadedURLs.push(url),
				},
			});
			const instance = skill();
			await instance.download("https://github.com/test/repo");
			expect(downloadedURLs.length).toBe(1);
			expect(downloadedURLs[0]).toBe("https://github.com/test/repo");
		});

		test("onIndexUpdate is called after download", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const updatedIndices: SkillIndex[] = [];
			const skill = createSkill({
				storage,
				download: async () => [makeDetail("skill-a")],
				get: async () => null,
				hooks: {
					onIndexUpdate: (index) => updatedIndices.push(index),
				},
			});
			const instance = skill();
			await instance.download("https://github.com/test/repo");
			expect(updatedIndices.length).toBe(1);
			expect(updatedIndices[0].skills.length).toBe(1);
			expect(updatedIndices[0].updateTime).toBeGreaterThan(0);
		});
	});

	describe("config hooks", () => {
		test("config hooks override options hooks", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const optionsListed: SkillMeta[][] = [];
			const configListed: SkillMeta[][] = [];
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
				hooks: {
					onList: (skills) => optionsListed.push(skills),
				},
			});
			const instance = skill({
				hooks: {
					onList: (skills) => configListed.push(skills),
				},
			});
			await instance.list();
			expect(optionsListed.length).toBe(0);
			expect(configListed.length).toBe(1);
		});
	});

	describe("default hooks", () => {
		test("works without any hooks", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const skill = createSkill({
				storage,
				download: async () => [makeDetail("skill-a")],
				get: async () => makeDetail("skill-a"),
			});
			const instance = skill();
			await instance.list();
			await instance.get("skill-a");
			await instance.download("https://github.com/test/repo");
		});
	});

	describe("debug", () => {
		test("logs with custom logger", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const messages: string[] = [];
			const skill = createSkill({
				storage,
				download: async () => [makeDetail("skill-a")],
				get: async () => makeDetail("test"),
				debug: {
					enabled: true,
					logger: (msg) => messages.push(msg),
				},
			});
			const instance = skill();
			await instance.list();
			await instance.get("test-skill");
			await instance.download("https://github.com/test/repo");
			expect(messages.some((m) => m.includes("[skill] list"))).toBe(true);
			expect(messages.some((m) => m.includes("[skill] get"))).toBe(true);
			expect(messages.some((m) => m.includes("[skill] download"))).toBe(true);
		});

		test("uses console.log when no custom logger", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const consoleSpy = spyOn(console, "log");
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
				debug: { enabled: true },
			});
			const instance = skill();
			await instance.list();
			expect(consoleSpy).toHaveBeenCalledWith("[skill] list");
			consoleSpy.mockRestore();
		});

		test("does not log when disabled", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const messages: string[] = [];
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
				debug: {
					enabled: false,
					logger: (msg) => messages.push(msg),
				},
			});
			const instance = skill();
			await instance.list();
			expect(messages.length).toBe(0);
		});

		test("does not log when debug is undefined", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const consoleSpy = spyOn(console, "log");
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
			});
			const instance = skill();
			await instance.list();
			expect(consoleSpy).not.toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe("indexKey", () => {
		test("uses custom indexKey", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const skill = createSkill({
				storage,
				download: async () => [makeDetail("skill-a")],
				get: async () => null,
				indexKey: "custom-index",
			});
			const instance = skill();
			await instance.download("https://github.com/test/repo");
			const customIndex = await storage.getItem("custom-index");
			expect(customIndex).toBeDefined();
			const defaultIndex = await storage.getItem("skills");
			expect(defaultIndex).toBeNull();
		});
	});

	describe("generateKey", () => {
		test("uses custom generateKey function", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const skill = createSkill({
				storage,
				download: async () => [makeDetail("skill-a")],
				get: async () => makeDetail("skill-a"),
				generateKey: (name) => `custom:${name}`,
			});
			const instance = skill();
			await instance.download("https://github.com/test/repo");
			const stored = await storage.getItem("custom:skill-a");
			expect(stored).toBeDefined();
			const defaultStored = await storage.getItem("skills:skill-a");
			expect(defaultStored).toBeNull();
		});
	});

	describe("getIndex", () => {
		test("returns stored index when it exists", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const existingIndex: SkillIndex = {
				skills: [{ name: "pre-existing", description: "already there" }],
				updateTime: 1000,
			};
			await storage.setItem("skills", existingIndex);
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
			});
			const instance = skill();
			const result = await instance.list();
			expect(result).toEqual([{ name: "pre-existing", description: "already there" }]);
		});

		test("returns default index when storage is empty", async () => {
			const storage = createStorage({ driver: memoryDriver() });
			const skill = createSkill({
				storage,
				download: async () => [],
				get: async () => null,
			});
			const instance = skill();
			const result = await instance.list();
			expect(result).toEqual([]);
		});
	});
});
