import v0GuideGettingStarted from "@/content/v0/guide/getting-started.md";
import v0Index from "@/content/v0/index.md";
import v0PackagesExecute from "@/content/v0/packages/execute.md";
import v0PackagesMemo from "@/content/v0/packages/memo.md";
import v0PackagesMemory from "@/content/v0/packages/memory.md";
import v0PackagesSkill from "@/content/v0/packages/skill.md";

import v1GuideGettingStarted from "@/content/v1/guide/getting-started.md";
import v1Index from "@/content/v1/index.md";

const pages: Record<string, string> = {
	"/v0/": v0Index,
	"/v0/guide/getting-started": v0GuideGettingStarted,
	"/v0/packages/execute": v0PackagesExecute,
	"/v0/packages/memo": v0PackagesMemo,
	"/v0/packages/memory": v0PackagesMemory,
	"/v0/packages/skill": v0PackagesSkill,
	"/v1/": v1Index,
	"/v1/guide/getting-started": v1GuideGettingStarted,
};

export function getContent(path: string): string | null {
	return pages[path] ?? null;
}

export function getRoutes(): string[] {
	return Object.keys(pages);
}

export type DocsVersion = "v0" | "v1";

export const versionInfo: Record<DocsVersion, { label: string; note?: string }> = {
	v0: { label: "v0" },
	v1: { label: "v1" },
};

export function getVersion(route: string): DocsVersion | undefined {
	const seg = route.split("/")[1];
	if (seg === "v0" || seg === "v1") return seg as DocsVersion;
	return undefined;
}

export function getVersionRoutes(version: DocsVersion): string[] {
	const prefix = `/${version}`;
	return getRoutes().filter((r) => r === `${prefix}/` || r.startsWith(`${prefix}/`));
}
