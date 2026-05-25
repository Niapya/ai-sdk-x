import { parseDocument } from "yaml";
import type { JsonRecord } from "@/utils/json";
import { isJsonRecord } from "@/utils/json";

export interface MarkdownFrontmatter {
	body: string;
	frontmatter: JsonRecord;
}

export function parseMarkdownFrontmatter(markdown: string): MarkdownFrontmatter {
	if (!markdown.startsWith("---\n")) {
		return { body: markdown, frontmatter: {} };
	}

	const end = markdown.indexOf("\n---", 4);
	if (end === -1) {
		return { body: markdown, frontmatter: {} };
	}

	const rawFrontmatter = markdown.slice(4, end);
	const afterFence = markdown.slice(end + "\n---".length);
	const body = afterFence.startsWith("\n") ? afterFence.slice(1) : afterFence;
	const document = parseDocument(rawFrontmatter);
	const parsed = document.toJSON();

	if (!isJsonRecord(parsed)) {
		return { body, frontmatter: {} };
	}

	return { body, frontmatter: parsed };
}
