import type { JsonRecord, JsonValue } from "@/utils/json";

export function frontmatterDescription(frontmatter: JsonRecord): string {
	const description = frontmatter.description;
	return typeof description === "string" ? description : "";
}

export function frontmatterName(frontmatter: JsonRecord): string {
	const name = frontmatter.name;
	return typeof name === "string" ? name : "";
}

export function stringifyFrontmatter(frontmatter: JsonRecord): Record<string, string> {
	const output: Record<string, string> = {};

	for (const [key, value] of Object.entries(frontmatter)) {
		if (isBlockedMetadataKey(key)) {
			continue;
		}

		output[key] = stringifyMetadataValue(value);
	}

	return output;
}

function stringifyMetadataValue(value: JsonValue): string {
	if (typeof value === "string") {
		return value;
	}

	return JSON.stringify(value);
}

function isBlockedMetadataKey(key: string): boolean {
	return key === "__proto__" || key === "constructor" || key === "prototype";
}
