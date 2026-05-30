import { describe, expect, it } from "bun:test";
import { normalizeNewlines, stripHeredoc, toErrorMessage } from "@/utils/text";

describe("text utils", () => {
	it("normalizes CRLF and CR newlines", () => {
		expect(normalizeNewlines("a\r\nb\rc\n")).toBe("a\nb\nc\n");
	});

	it("strips simple heredoc wrappers", () => {
		expect(stripHeredoc("cat <<'PATCH'\nhello\nPATCH")).toBe("hello");
		expect(stripHeredoc("plain text")).toBe("plain text");
	});

	it("formats unknown errors", () => {
		expect(toErrorMessage(new Error("boom"))).toBe("boom");
		expect(toErrorMessage("plain")).toBe("plain");
	});
});
