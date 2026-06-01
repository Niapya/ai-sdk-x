"use client";

import { useState } from "react";

import { Toc } from "@/components/Toc";
import type { TocItem } from "@/lib/docs-data";

export function TocMenu({ toc }: { toc: TocItem[] }) {
	const [open, setOpen] = useState(false);

	return (
		<div className="fixed right-5 bottom-5 z-[80] lg:hidden">
			<button
				type="button"
				aria-label="Open table of contents sidebar"
				aria-expanded={open}
				onClick={() => setOpen(true)}
				className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-zinc-950 text-white shadow-[0_16px_44px_-18px_rgba(15,23,42,0.55)] transition-colors hover:bg-zinc-800 dark:border-zinc-700 dark:bg-white dark:text-zinc-950"
			>
				<span className="text-xs font-bold">TOC</span>
			</button>
			{open ? (
				<div className="fixed inset-0 z-[100] lg:hidden">
					<button
						type="button"
						aria-label="Close table of contents sidebar"
						className="absolute inset-0 bg-zinc-950/50"
						onClick={() => setOpen(false)}
					/>
					<aside className="absolute right-0 top-0 h-dvh w-80 max-w-[86vw] overflow-y-auto border-l border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
						<Toc toc={toc} onNavigate={() => setOpen(false)} />
					</aside>
				</div>
			) : null}
		</div>
	);
}
