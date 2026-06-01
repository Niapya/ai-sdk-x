import Link from "next/link";

import { getVersion, versionInfo } from "@/docs-nav";

function NavigationSidebarContent({
	currentPath,
	onNavigate,
}: {
	currentPath: string;
	onNavigate?: () => void;
}) {
	const version = getVersion(currentPath);

	if (!version) {
		return <p className="text-sm text-zinc-500">Select a version above</p>;
	}

	const nav = versionInfo[version];

	return (
		<>
			<div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
				<p className="text-sm font-semibold text-zinc-900 dark:text-white">Navigation</p>
			</div>
			<div className="px-3 py-4">
				<div className="mb-5">
					<ul className="space-y-1">
						<li>
							<Link
								href={`/${version}/`}
								aria-current={currentPath === `/${version}/` ? "page" : undefined}
								onClick={onNavigate}
								className={`block rounded-xl px-3 py-2 text-sm transition-colors ${
									currentPath === `/${version}/`
										? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
										: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
								}`}
							>
								Overview
							</Link>
						</li>
					</ul>
				</div>
				<div className="space-y-6">
					{nav.sections.map((section) => (
						<section key={section.title}>
							<h2 className="mb-2 px-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
								{section.title}
							</h2>
							<ul className="space-y-1">
								{section.items.map((item) => {
									const active = currentPath === item.path || currentPath === `${item.path}/`;

									return (
										<li key={item.path}>
											<Link
												href={item.path}
												aria-current={active ? "page" : undefined}
												onClick={onNavigate}
												className={`block rounded-xl px-3 py-2 text-sm transition-colors ${
													active
														? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
														: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white"
												}`}
											>
												{item.label}
											</Link>
										</li>
									);
								})}
							</ul>
						</section>
					))}
				</div>
			</div>
		</>
	);
}

export function NavigationSidebar({
	currentPath,
	onNavigate,
	className = "",
}: {
	currentPath: string;
	onNavigate?: () => void;
	className?: string;
}) {
	return (
		<nav
			className={`rounded-[28px] border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-950 ${className}`}
		>
			<NavigationSidebarContent currentPath={currentPath} onNavigate={onNavigate} />
		</nav>
	);
}
