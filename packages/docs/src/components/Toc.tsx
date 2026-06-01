import type { TocItem } from "@/lib/docs-data";

export function Toc({ toc, onNavigate }: { toc: TocItem[]; onNavigate?: () => void }) {
	if (toc.length === 0) {
		return <p className="text-sm text-zinc-500 dark:text-zinc-400">No sections</p>;
	}

	return (
		<nav aria-label="Table of contents">
			<p className="docs-toc-title">On this page</p>
			<ul className="docs-toc-list">
				{toc.map((item) => (
					<li key={item.href}>
						<a
							href={item.href}
							onClick={onNavigate}
							className={`docs-toc-link ${item.depth === 3 ? "pl-5 text-xs" : ""}`}
						>
							{item.title}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
