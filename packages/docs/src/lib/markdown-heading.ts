import type { ReactNode } from "react";

export function getTextContent(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") {
		return String(node);
	}
	if (Array.isArray(node)) {
		return node.map(getTextContent).join("");
	}
	if (node && typeof node === "object" && "props" in node) {
		const props = node.props as { children?: ReactNode };
		return getTextContent(props.children);
	}
	return "";
}

export function slugifyHeading(value: string): string {
	return value
		.toLowerCase()
		.trim()
		.replace(/[`"'’]/g, "")
		.replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
