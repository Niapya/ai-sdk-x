import { afterEach, describe, expect, it } from "bun:test";
import { searchSkills } from "@/features/skills/search";

const originalFetch = globalThis.fetch;

describe("x-skills search", () => {
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("searches skills.sh and prints install commands", async () => {
		globalThis.fetch = (async () =>
			new Response(
				JSON.stringify({
					skills: [
						{
							id: "owner/repo/context7",
							installs: 1200,
							name: "context7",
							source: "https://github.com/owner/repo",
						},
					],
				}),
				{ status: 200 },
			)) as unknown as typeof fetch;

		const result = await searchSkills("context7");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("Search results for `context7`.");
		expect(result.stdout).toContain(
			"Install: x-skills install https://github.com/owner/repo@context7",
		);
	});
});
