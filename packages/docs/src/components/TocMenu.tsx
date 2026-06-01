"use client";

import { useState } from "react";

import { Toc } from "@/components/Toc";
import type { TocItem } from "@/lib/docs-data";

export function TocMenu({ toc }: { toc: TocItem[] }) {
	const [open, setOpen] = useState(false);

	return (
		<div className="lg:hidden">
			<button
				type="button"
				aria-label="Open table of contents"
				aria-expanded={open}
				onClick={() => setOpen(true)}
				className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-zinc-950 text-white shadow-[0_16px_44px_-18px_rgba(15,23,42,0.55)] transition-colors hover:bg-zinc-800 dark:border-zinc-700 dark:bg-white dark:text-zinc-950"
			>
				<span className="text-xs font-bold">TOC</span>
			</button>
			{open ? (
				<div className="fixed inset-0 z-50 lg:hidden">
					<button
						type="button"
						aria-label="Close table of contents overlay"
						className="absolute inset-0 bg-zinc-950/50"
						onClick={() => setOpen(false)}
					/>
					<div className="scrollbar-none absolute bottom-0 right-0 max-h-[78vh] w-[min(22rem,88vw)] overflow-y-auto rounded-tl-[2rem] border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
						<Toc toc={toc} onNavigate={() => setOpen(false)} />
					</div>
				</div>
			) : null}
		</div>
	);
}
