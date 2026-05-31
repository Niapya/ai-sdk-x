import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-memory update", () => {
	it("updates daily memory metadata and body", async () => {
		const x = X.init();
		await x.exec("x-memory add release-note --description 'Old summary' --keyword old --stdin", {
			stdin: "Old body",
		});

		const result = await x.exec(
			"x-memory update release-note --description 'New summary' --keyword new --stdin",
			{ stdin: "New body" },
		);

		expect(result.exitCode).toBe(0);
		const dailyPath = result.stdout.match(
			/at (\$MEMORY_HOME\/daily\/\d{4}-\d{2}-\d{2}\/release-note\.md) Successfully!/,
		)?.[1];
		expect(dailyPath).toBeDefined();
		if (!dailyPath) {
			throw new Error(`missing daily path in output: ${result.stdout}`);
		}
		expect(result.stdout).toBe(
			`Update memory release-note in category daily at ${dailyPath} Successfully!\n`,
		);
		expect(await x.fs.readFile(dailyPath.replace("$MEMORY_HOME", "/home/user/memory"))).toBe(
			"New body",
		);
		const index = JSON.parse(await x.fs.readFile("/home/user/memory/memory.json"));
		expect(index.categories.daily["release-note"].description).toBe("New summary");
		expect(index.categories.daily["release-note"].keywords).toEqual(["new"]);
	});

	it("updates core file body without writing daily metadata", async () => {
		const x = X.init();

		const result = await x.exec("x-memory update AGENT.md --stdin", {
			stdin: "Agent-side note",
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe(
			"Update memory AGENT.md at /home/user/memory/AGENT.md Successfully!\n",
		);
		expect(await x.fs.readFile("/home/user/memory/AGENT.md")).toBe("Agent-side note");
		const index = JSON.parse(await x.fs.readFile("/home/user/memory/memory.json"));
		expect(index.categories).toEqual({});
	});

	it("rejects non-daily categories", async () => {
		const x = X.init();

		const result = await x.exec("x-memory update note --category project --description 'A'");

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("only daily category is supported");
	});
});
