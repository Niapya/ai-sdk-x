import { describe, expect, it } from "bun:test";
import X from "@/index";

describe("x-skills remove", () => {
	it("removes a skill and returns the new success message", async () => {
		const x = X.init();
		await writeLocalSkill(x, "/tmp/remove-source", {
			description: "Remove me",
			name: "Remove",
		});
		await x.exec("x-skills import /tmp/remove-source remove-me");

		const result = await x.exec("x-skills remove -y remove-me");

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("Remove `remove-me` successfully.\n");
		expect(await x.fs.exists("/home/user/skills/remove-me")).toBe(false);
	});
});

async function writeLocalSkill(
	x: X,
	path: string,
	input: { description: string; name: string },
): Promise<void> {
	await x.fs.mkdir(path, { recursive: true });
	await x.fs.writeFile(
		`${path}/SKILL.md`,
		["---", `name: ${input.name}`, `description: ${input.description}`, "---", ""].join("\n"),
	);
}
