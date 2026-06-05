export type DocsVersion = "v0" | "v1";

export type NavItem = {
	label: string;
	path: string;
	slug: string[];
};

export type NavSection = {
	title: string;
	items: NavItem[];
};

export type TocItem = {
	depth: 2 | 3;
	title: string;
	href: string;
};

export type DocMeta = {
	title: string;
	version: DocsVersion;
	slug: string[];
	path: string;
	toc: TocItem[];
};

export const DOCS_VERSIONS = ["v0", "v1"] as const satisfies readonly DocsVersion[];

export const versionInfo: Record<DocsVersion, { label: string; sections: NavSection[] }> = {
	v0: {
		label: "v0",
		sections: [
			{
				title: "Guide",
				items: [navItem("Getting Started", "v0", ["guide", "getting-started"])],
			},
			{
				title: "Packages",
				items: [
					navItem("Execute", "v0", ["packages", "execute"]),
					navItem("Memo", "v0", ["packages", "memo"]),
					navItem("Memory", "v0", ["packages", "memory"]),
					navItem("Skill", "v0", ["packages", "skill"]),
				],
			},
		],
	},
	v1: {
		label: "v1",
		sections: [
			{
				title: "Intro",
				items: [navItem("About", "v1", ["about"])],
			},
			{
				title: "Guide",
				items: [
					navItem("Quick Start", "v1", ["guide", "quick-start"]),
					navItem("Custom Start", "v1", ["guide", "custom-start"]),
					navItem("Mount Custom Storage", "v1", ["guide", "mount-custom-storage"]),
					navItem("Create Your Command", "v1", ["guide", "create-your-command"]),
					navItem("Create Your Hooks", "v1", ["guide", "create-your-hooks"]),
					navItem("Create Your Feature", "v1", ["guide", "create-your-feature"]),
					navItem("Use With AI SDK", "v1", ["guide", "use-with-ai-sdk"]),
					navItem("Serverless and Embedded", "v1", ["guide", "serverless-and-embedded"]),
				],
			},
			{
				title: "Features",
				items: [
					navItem("Git", "v1", ["features", "git"]),
					navItem("Workspace", "v1", ["features", "workspace"]),
					navItem("Patch", "v1", ["features", "patch"]),
					navItem("Memory", "v1", ["features", "memory"]),
					navItem("Skills", "v1", ["features", "skills"]),
				],
			},
			{
				title: "Runtime",
				items: [
					navItem("Overview", "v1", ["runtime", "overview"]),
					navItem("Environment", "v1", ["runtime", "environment"]),
					navItem("Backend Storage", "v1", ["runtime", "backend-storage"]),
					navItem("File System", "v1", ["runtime", "file-system"]),
				],
			},
			{
				title: "Examples",
				items: [navItem("Example", "v1", ["example"])],
			},
		],
	},
};

function navItem(label: string, version: DocsVersion, slug: string[]): NavItem {
	return {
		label,
		path: toDocPath(version, slug),
		slug,
	};
}

export function toDocPath(version: DocsVersion, slug: string[] = []): string {
	return `/${[version, ...slug].join("/")}/`;
}

export function normalizePath(value: string): string {
	if (value === "/") return "/";
	return value.endsWith("/") ? value : `${value}/`;
}
