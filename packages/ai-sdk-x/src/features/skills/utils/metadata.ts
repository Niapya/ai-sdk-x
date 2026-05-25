import type { JsonRecord } from "@/utils/json";

export function frontmatterDescription(frontmatter: JsonRecord): string {
	const description = frontmatter.description;
	return typeof description === "string" ? description : "";
}
