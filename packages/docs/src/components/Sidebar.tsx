import { getRoutes } from "@/content";
import { navigate, useRoute } from "@/router";

export function Sidebar() {
	const route = useRoute();
	const version = route.split("/")[1] || "";
	const prefix = `/${version}`;

	const routes = getRoutes().filter((r) => r.startsWith(prefix));

	const tree = new Map<string, string[]>();
	for (const r of routes) {
		const rel = r.slice(prefix.length).replace(/\/$/, "") || "/";
		const parent = rel === "/" ? "/" : `/${rel.split("/").slice(0, -1).join("/")}`;
		if (!tree.has(parent)) tree.set(parent, []);
		tree.get(parent)?.push(rel);
	}

	return (
		<nav className="flex flex-col gap-4">
			{routes.length === 0 && <p className="text-sm text-zinc-400">Select a version above</p>}
			{Array.from(tree.entries()).map(([parent, items]) => {
				if (parent === "/") {
					const active = route === `${prefix}/`;
					return (
						<div key={parent}>
							<ul className="flex flex-col gap-1">
								{items.map((item) => (
									<li key={item}>
										<button
											type="button"
											className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
												active
													? "bg-zinc-100 text-zinc-900 font-medium dark:bg-zinc-800 dark:text-white"
													: "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
											}`}
											onClick={() => navigate(prefix + item)}
										>
											Home
										</button>
									</li>
								))}
							</ul>
						</div>
					);
				}
				const parentLabel = parent
					.replace(/^\//, "")
					.split("/")
					.map((s) => s.charAt(0).toUpperCase() + s.slice(1))
					.join(" / ");
				return (
					<div key={parent}>
						<h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
							{parentLabel}
						</h2>
						<ul className="flex flex-col gap-1">
							{items.map((item) => {
								const fullPath = prefix + item;
								const active = route === fullPath;
								const label = item
									.split("/")
									.pop()
									?.replace(/-/g, " ")
									.replace(/\b\w/g, (c) => c.toUpperCase());
								return (
									<li key={item}>
										<button
											type="button"
											className={`block w-full rounded px-2 py-1 text-left text-sm transition-colors ${
												active
													? "bg-zinc-100 text-zinc-900 font-medium dark:bg-zinc-800 dark:text-white"
													: "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
											}`}
											onClick={() => navigate(fullPath)}
										>
											{label}
										</button>
									</li>
								);
							})}
						</ul>
					</div>
				);
			})}
		</nav>
	);
}
