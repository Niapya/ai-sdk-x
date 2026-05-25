import { Markdown } from "@/components/Markdown";
import { type DocsVersion, getContent, getVersionRoutes, versionInfo } from "@/content";
import { navigate } from "@/router";

function getArticleTitle(path: string, version: DocsVersion) {
	const relativePath = path.replace(`/${version}/`, "");
	if (relativePath === "") {
		return "Overview";
	}

	const label = relativePath
		.split("/")
		.slice(-1)[0]
		.replace(/-/g, " ")
		.replace(/\b\w/g, (character) => character.toUpperCase());

	return label;
}

function getSectionLabel(path: string, version: DocsVersion) {
	const relativePath = path.replace(`/${version}/`, "");
	if (relativePath === "") {
		return "Overview";
	}

	const [section] = relativePath.split("/");
	return section.replace(/-/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function VersionHome({ version }: { version: DocsVersion }) {
	const routes = getVersionRoutes(version);
	const intro = getContent(`/${version}/`);
	const groupedRoutes = new Map<string, string[]>();

	for (const route of routes) {
		const section = getSectionLabel(route, version);
		const items = groupedRoutes.get(section) ?? [];
		items.push(route);
		groupedRoutes.set(section, items);
	}

	return (
		<div className="space-y-10">
			<div className="space-y-4">
				<p className="text-sm font-semibold uppercase tracking-[0.24em] text-zinc-500">
					{versionInfo[version].label}
				</p>
				{intro && <Markdown content={intro} />}
				<div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300">
					{versionInfo[version].note}
				</div>
			</div>

			<div className="space-y-6">
				<h2 className="text-xl font-semibold text-zinc-900 dark:text-white">All articles</h2>
				<div className="space-y-6">
					{Array.from(groupedRoutes.entries()).map(([section, sectionRoutes]) => (
						<section key={section} className="space-y-3">
							<h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
								{section}
							</h3>
							<div className="grid gap-3 sm:grid-cols-2">
								{sectionRoutes.map((route) => (
									<button
										key={route}
										type="button"
										className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-850"
										onClick={() => navigate(route)}
									>
										<p className="text-sm font-semibold text-zinc-900 dark:text-white">
											{getArticleTitle(route, version)}
										</p>
										<p className="mt-1 text-xs text-zinc-500">{route}</p>
									</button>
								))}
							</div>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
