import type { DocsVersion } from "@/lib/docs-data";

export type { DocsVersion, NavItem, NavSection, TocItem } from "@/lib/docs-data";
export { normalizePath, versionInfo } from "@/lib/docs-data";

export function getVersion(path: string): DocsVersion | undefined {
	const segment = path.split("/").filter(Boolean)[0];
	if (segment === "v0" || segment === "v1") return segment;
	return undefined;
}
