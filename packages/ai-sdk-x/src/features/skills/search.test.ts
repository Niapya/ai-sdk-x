import { afterEach, describe, expect, it } from "bun:test";
import { createCommand } from "@/utils";
import { createSearchSkillsCommand, searchSkills } from "./search";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("searchSkills", () => {
	it("returns usage error when query is empty", async () => {
		const result = await searchSkills("   \n\t");

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("missing query");
		expect(result.stdout).toBe("");
	});

	it("returns empty result message when API is unavailable", async () => {
		globalThis.fetch = (async () => new Response("{}", { status: 503 })) as unknown as typeof fetch;

		const result = await searchSkills("demo");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('No skills found for "demo"');
	});

	it("returns empty result message when fetch throws", async () => {
		globalThis.fetch = (async () => {
			throw new Error("network");
		}) as unknown as typeof fetch;

		const result = await searchSkills("demo");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('No skills found for "demo"');
	});

	it("formats, sanitizes, sorts, and limits search results", async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					skills: [
						{ id: "a", installs: 1, name: "alpha\nname", source: "repo/a" },
						{ id: "b", installs: 1200, name: "beta", source: "" },
						{ id: "c", installs: 2_000_000, name: "charlie", source: "repo/c" },
						{ id: "d", installs: 400, name: "delta", source: "repo/d" },
						{ id: "e", installs: 5, name: "echo", source: "repo/e" },
						{ id: "f", installs: 9, name: "foxtrot", source: "repo/f" },
						{ id: "g", installs: 10, name: "golf", source: "repo/g" },
					],
				}),
				{ status: 200 },
			)) as unknown as typeof fetch;

		const result = await searchSkills("demo skill");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Install with x-skills install <git-url@skill>");
		expect(result.stdout).toContain("repo/c@charlie (2M installs)");
		expect(result.stdout).toContain("b@beta (1.2K installs)");
		expect(result.stdout).toContain("repo/d@delta (400 installs)");
		expect(result.stdout).toContain("https://skills.sh/c");
		expect(result.stdout).not.toContain("repo/a@alpha\nname");
		expect(result.stdout).not.toContain("repo/a@alpha name");
	});
});

describe("createSearchSkillsCommand", () => {
	it("joins multi-word query args before searching", async () => {
		let requestedUrl = "";
		globalThis.fetch = (async (input: string | URL | Request) => {
			requestedUrl = String(input);
			return new Response(JSON.stringify({ skills: [] }), { status: 200 });
		}) as unknown as typeof fetch;

		const command = createCommand(createSearchSkillsCommand());
		const result = await command.execute(["context", "7"], {
			bash: null,
			command: null,
			metadata: {},
		} as never);

		expect(result.exitCode).toBe(0);
		expect(requestedUrl).toContain("q=context%207");
	});
});
