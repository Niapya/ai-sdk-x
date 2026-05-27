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

	it("handles empty stdout and stderr without truncation", () => {
		const output = truncateToolOutput("", "", { maxOutput: 100 });
		expect(output.stdout).toBe("");
		expect(output.stderr).toBe("");
	});

	it("handles empty stdout with non-empty stderr within limits", () => {
		const output = truncateToolOutput("", "error", { maxOutput: 100 });
		expect(output.stdout).toBe("");
		expect(output.stderr).toBe("error");
	});

	it("handles non-empty stdout with empty stderr within limits", () => {
		const output = truncateToolOutput("output", "", { maxOutput: 100 });
		expect(output.stdout).toBe("output");
		expect(output.stderr).toBe("");
	});

	it("truncates only the empty stdout allocation to 0 when stderr alone exceeds limit", () => {
		// stdout is empty, stderr is 200 chars, maxOutput 50
		const output = truncateToolOutput("", "x".repeat(200), { maxOutput: 50 });
		expect(output.stdout).toBe("");
		expect(output.stderr.length).toBeLessThanOrEqual(50);
		expect(output.stderr).toContain("truncated");
	});

	it("preserves exact output at boundary without truncation hint", () => {
		const output = truncateToolOutput("abc", "def", { maxOutput: 6 });
		expect(output.stdout).toBe("abc");
		expect(output.stderr).toBe("def");
	});

	it("respects maxLines=1 leaving only the first line", () => {
		const output = truncateToolOutput("line1\nline2\nline3", "", {
			maxLines: 1,
			maxOutput: 1000,
		});
		expect(output.stdout).toContain("line1");
		expect(output.stdout).not.toContain("line2");
		expect(output.stdout).toContain("truncated");
	});

	it("does not truncate when maxLines equals actual line count", () => {
		const output = truncateToolOutput("a\nb\nc", "", { maxLines: 3, maxOutput: 1000 });
		expect(output.stdout).toBe("a\nb\nc");
	});
});
