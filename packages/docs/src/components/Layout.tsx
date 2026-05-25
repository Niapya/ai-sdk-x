import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import type { DocsVersion } from "@/content";
import logoUrl from "@/logo.svg";
import { navigate } from "@/router";

export function Layout({
	children,
	version,
	noSidebar,
}: {
	children: ReactNode;
	version?: DocsVersion;
	noSidebar?: boolean;
}) {
	const versions = [
		{ label: "v0", path: "/v0/" },
		{ label: "v1", path: "/v1/" },
	];

	return (
		<div className="min-h-screen bg-white dark:bg-zinc-900">
			<style>{":root { color-scheme: light dark; }"}</style>
			<header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
				<div className="mx-auto flex h-14 max-w-360 items-center gap-4 px-6">
					<button
						type="button"
						className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white"
						onClick={() => navigate("/")}
					>
						<img src={logoUrl} alt="Logo" className="h-6 w-6" />
						<span>AI SDK X</span>
					</button>
					<nav className="ml-auto flex items-center gap-2 text-sm">
						{versions.map((item) => {
							const active = version === item.label;

							return (
								<button
									key={item.label}
									type="button"
									aria-current={active ? "page" : undefined}
									className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
										active
											? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
											: "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
									}`}
									onClick={() => navigate(item.path)}
								>
									{item.label}
								</button>
							);
						})}
						<a
							href="https://github.com/niapya/ai-sdk-x"
							target="_blank"
							rel="noopener noreferrer"
							className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
						>
							GitHub
						</a>
					</nav>
				</div>
			</header>
			{noSidebar ? (
				<main className="min-w-0 flex-1">{children}</main>
			) : (
				<div className="mx-auto flex max-w-360">
					<aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-zinc-200 p-6 dark:border-zinc-800 lg:block">
						<Sidebar />
					</aside>
					<main className="min-w-0 flex-1 px-6 py-8 lg:px-8">
						<div className="mx-auto max-w-3xl">{children}</div>
					</main>
				</div>
			)}
		</div>
	);
}
