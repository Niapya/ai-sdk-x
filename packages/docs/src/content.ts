import v0GuideGettingStarted from "@/content/v0/guide/getting-started.txt";
import v0Index from "@/content/v0/index.txt";
import v0PackagesExecute from "@/content/v0/packages/execute.txt";
import v0PackagesMemo from "@/content/v0/packages/memo.txt";
import v0PackagesMemory from "@/content/v0/packages/memory.txt";
import v0PackagesSkill from "@/content/v0/packages/skill.txt";
import v1GuideGettingStarted from "@/content/v1/guide/getting-started.txt";
import v1Index from "@/content/v1/index.txt";

export type DocsVersion = "v0" | "v1";

export function getVersion(path: string): DocsVersion | null {
	const version = path.split("/")[1];

	if (version === "v0" || version === "v1") {
		return version;
	}

	return null;
}

export const versionInfo: Record<DocsVersion, { label: string; note: string }> = {
	v0: {
		label: "v0",
		note: "V0 includes package docs for execute, memo, memory, and skill. These package pages do not exist in V1, so we recommend switching to V1 for the newer guide-first docs.",
	},
	v1: {
		label: "v1",
		note: "V1 focuses on the current AI SDK X guide set.",
	},
};

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

export function getVersionRoutes(version: DocsVersion): string[] {
	const prefix = `/${version}/`;
	return getRoutes().filter((route) => route.startsWith(prefix) && route !== prefix);
}
