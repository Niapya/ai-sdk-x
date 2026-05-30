import { describe, expect, it } from "bun:test";
import { quoteForShell } from "@/utils/shell";

describe("shell utils", () => {
	it("double-quotes shell arguments and escapes quotes/backslashes", () => {
		expect(quoteForShell('repo "name"\\path')).toBe('"repo \\"name\\"\\\\path"');
	});
});
