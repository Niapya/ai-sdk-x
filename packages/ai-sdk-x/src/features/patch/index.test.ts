import { describe, expect, it } from "bun:test";
import { type CommandContext, EMPTY_BYTES, encodeUtf8ToBytes, InMemoryFs } from "just-bash";
import { createPatchCommand, createPatchFeature } from "@/features/patch";

const HOME = "/Users/tester";

describe("x-patch", () => {
	it("describes bash usage and stdin patch input", async () => {
		const feature = createPatchFeature(true);
		const text = await feature.description?.({} as never);

		expect(text).toContain("not as a separate callable tool");
		expect(text).toContain('command="x-patch" with stdin="*** Begin Patch\\n..."');
	});

	it("applies inline patch content relative to cwd by default", async () => {
		const fs = new InMemoryFs();
		const cwd = "/repo/app";
		const command = createPatchCommand();

		await fs.mkdir(cwd, { recursive: true });

		const result = await command.execute(
			["*** Begin Patch\n*** Add File: src/message.txt\n+hello\n*** End Patch"],
			createContext({ cwd, fs }),
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("A src/message.txt\n");
		expect(await fs.readFile("/repo/app/src/message.txt")).toBe("hello");
	});

	it("reads patch files from --file and resolves relative targets from --base", async () => {
		const fs = new InMemoryFs();
		const cwd = "/repo";
		const command = createPatchCommand();

		await fs.mkdir("/repo/packages/app", { recursive: true });
		await fs.writeFile(
			"/repo/change.patch",
			"*** Begin Patch\n*** Add File: src/index.ts\n+export const value = 1;\n*** End Patch",
		);

		const result = await command.execute(
			["--file", "change.patch", "--base", "./packages/app"],
			createContext({ cwd, fs }),
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("A src/index.ts\n");
		expect(await fs.readFile("/repo/packages/app/src/index.ts")).toBe("export const value = 1;");
	});

	it("reads patch content from stdin", async () => {
		const fs = new InMemoryFs();
		const cwd = "/repo/app";
		const command = createPatchCommand();

		await fs.mkdir(cwd, { recursive: true });
		await fs.writeFile("/repo/app/notes.txt", "before\n");

		const result = await command.execute(
			[],
			createContext({
				cwd,
				fs,
				stdin: "*** Begin Patch\n*** Update File: notes.txt\n@@\n-before\n+after\n*** End Patch",
			}),
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("M notes.txt\n");
		expect(await fs.readFile("/repo/app/notes.txt")).toBe("after\n");
	});

	it("expands home-relative patch paths", async () => {
		const fs = new InMemoryFs();
		const cwd = "/repo/app";
		const command = createPatchCommand();

		await fs.mkdir(HOME, { recursive: true });
		await fs.writeFile(`${HOME}/note.txt`, "before\n");

		const result = await command.execute(
			["*** Begin Patch\n*** Update File: ~/note.txt\n@@\n-before\n+after\n*** End Patch"],
			createContext({ cwd, fs }),
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe(`M ${HOME}/note.txt\n`);
		expect(await fs.readFile(`${HOME}/note.txt`)).toBe("after\n");
	});

	it("expands home-relative base directories", async () => {
		const fs = new InMemoryFs();
		const cwd = "/repo";
		const command = createPatchCommand();

		await fs.mkdir(`${HOME}/project`, { recursive: true });

		const result = await command.execute(
			[
				"*** Begin Patch\n*** Add File: docs/readme.md\n+hello\n*** End Patch",
				"--base",
				"~/project",
			],
			createContext({ cwd, fs }),
		);

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("A docs/readme.md\n");
		expect(await fs.readFile(`${HOME}/project/docs/readme.md`)).toBe("hello");
	});
});

function createContext({
	cwd,
	fs,
	stdin,
}: {
	cwd: string;
	fs: InMemoryFs;
	stdin?: string;
}): CommandContext {
	return {
		cwd,
		env: new Map([["HOME", HOME]]),
		fs,
		stdin: stdin ? encodeUtf8ToBytes(stdin) : EMPTY_BYTES,
	};
}
