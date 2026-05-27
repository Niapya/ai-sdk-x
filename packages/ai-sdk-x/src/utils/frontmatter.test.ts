import { describe, expect, it } from "bun:test";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";

describe("parseMarkdownFrontmatter", () => {
	it("parses valid YAML frontmatter", () => {
		const input = "---\ntitle: Hello\nvalue: 42\n---\nBody text";
		const { frontmatter, body } = parseMarkdownFrontmatter(input);
		expect(frontmatter).toEqual({ title: "Hello", value: 42 });
		expect(body).toBe("Body text");
	});

	it("returns empty frontmatter when input does not start with ---", () => {
		const input = "No frontmatter here\n---\ntitle: test\n---\n";
		const { frontmatter, body } = parseMarkdownFrontmatter(input);
		expect(frontmatter).toEqual({});
		expect(body).toBe(input);
	});

	it("returns empty frontmatter when closing delimiter is missing", () => {
		const input = "---\ntitle: test\nno closing delimiter";
		const { frontmatter, body: _ } = parseMarkdownFrontmatter(input);
		expect(frontmatter).toEqual({});
	});

	it("returns empty frontmatter when YAML parses to a non-object (scalar string)", () => {
		// A YAML document that is just a bare scalar parses to a string, not a record
		const input = "---\nhello world\n---\nbody";
		const { frontmatter } = parseMarkdownFrontmatter(input);
		expect(frontmatter).toEqual({});
	});

	it("returns empty frontmatter for YAML that is not a plain object (array)", () => {
		const input = "---\n- a\n- b\n---\nbody";
		const { frontmatter } = parseMarkdownFrontmatter(input);
		expect(frontmatter).toEqual({});
	});

	it("body is empty string when nothing follows the closing ---", () => {
		const input = "---\ntitle: hi\n---\n";
		const { body } = parseMarkdownFrontmatter(input);
		expect(body).toBe("");
	});

	it("body preserves --- sequences that appear after the first closing delimiter", () => {
		const input = "---\ntitle: hi\n---\nFirst line\n---\nSecond section";
		const { body } = parseMarkdownFrontmatter(input);
		expect(body).toContain("---");
		expect(body).toContain("Second section");
	});

	it("empty frontmatter block parses to empty object", () => {
		// Must have content between delimiters so \n--- appears at position >= 4
		const input = "---\n\n---\nbody";
		const { frontmatter, body } = parseMarkdownFrontmatter(input);
		expect(frontmatter).toEqual({});
		expect(body).toBe("body");
	});

	it("frontmatter object is a plain JSON record (no prototype methods)", () => {
		const input = "---\nkey: value\n---\n";
		const { frontmatter } = parseMarkdownFrontmatter(input);
		expect(Object.getPrototypeOf(frontmatter)).toBe(Object.prototype);
	});
});
