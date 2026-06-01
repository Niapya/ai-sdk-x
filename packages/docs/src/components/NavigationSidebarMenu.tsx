"use client";

import { useState } from "react";

import { NavigationSidebar } from "@/components/NavigationSidebar";

export function NavigationSidebarMenu({ currentPath }: { currentPath: string }) {
	const [open, setOpen] = useState(false);

	return (
		<div className="fixed bottom-5 left-5 z-80 lg:hidden">
			<button
				type="button"
				aria-label="Open navigation sidebar"
				aria-expanded={open}
				onClick={() => setOpen(true)}
				className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-[0_16px_40px_-18px_rgba(15,23,42,0.4)] transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
			>
				<svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
					<path
						d="M4 7h16M4 12h16M4 17h16"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
					/>
				</svg>
			</button>
			{open ? (
				<div className="fixed inset-0 z-100 lg:hidden">
					<button
						type="button"
						aria-label="Close navigation sidebar"
						className="absolute inset-0 bg-zinc-950/50"
						onClick={() => setOpen(false)}
					/>
					<aside className="absolute left-0 top-0 h-dvh w-80 max-w-[86vw] overflow-y-auto border-r border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
						<NavigationSidebar
							currentPath={currentPath}
							onNavigate={() => setOpen(false)}
							className="min-h-full rounded-none border-0 shadow-none"
						/>
					</aside>
				</div>
			) : null}
		</div>
	);
}
