import { describe, expect, it } from "bun:test";
import { truncateToolOutput } from "@/runtime/output";

describe("truncateToolOutput", () => {
	it("returns original output when within limits", () => {
		const output = truncateToolOutput("ok", "warn", {
			maxLines: 0,
			maxOutput: 32,
		});

		expect(output).toEqual({
			stdout: "ok",
			stderr: "warn",
		});
	});

	it("applies line limits before output truncation", () => {
		const output = truncateToolOutput("a\nb\nc\nd", "", {
			maxLines: 2,
			maxOutput: 128,
		});

		expect(output.stdout).toContain("a\nb");
		expect(output.stdout).toContain("characters were truncated");
	});

	it("truncates stderr when stdout already fits budget", () => {
		const output = truncateToolOutput("short", "x".repeat(100), {
			maxOutput: 24,
		});

		expect(output.stdout).toBe("short");
		expect(output.stderr.length).toBe(19);
		expect(output.stderr).toContain("...");
	});

	it("truncates stdout when stderr already fits budget", () => {
		const output = truncateToolOutput("y".repeat(120), "err", {
			maxOutput: 20,
		});

		expect(output.stderr).toBe("err");
		expect(output.stdout.length).toBe(17);
		expect(output.stdout).toContain("...");
	});

	it("splits budget across both streams when both exceed maxOutput", () => {
		const output = truncateToolOutput("s".repeat(6000), "e".repeat(6000), {
			maxOutput: 5000,
		});

		expect(output.stdout.length).toBe(2000);
		expect(output.stderr.length).toBe(3000);
		expect(output.stdout).toContain("truncated");
		expect(output.stderr).toContain("truncated");
	});

	it("returns a sliced hint when truncation budget is tiny", () => {
		const output = truncateToolOutput("", "z".repeat(120), {
			maxOutput: 5,
		});

		expect(output.stdout).toBe("");
		expect(output.stderr.length).toBe(5);
	});
});
