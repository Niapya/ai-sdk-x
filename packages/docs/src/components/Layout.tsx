import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { withBasePath } from "@/lib/base-path";

export function Layout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-screen bg-white dark:bg-zinc-900">
			<header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
				<div className="mx-auto flex h-14 max-w-360 items-center gap-4 px-6">
					<Link
						href={withBasePath("/")}
						className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-white"
					>
						<Image src={withBasePath("/logo.svg")} alt="Logo" width={24} height={24} />
						<span>AI SDK X</span>
					</Link>
					<nav className="ml-auto flex items-center gap-2 text-sm">
						<Link
							href={withBasePath("/v0/")}
							className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
						>
							v0
						</Link>
						<Link
							href={withBasePath("/v1/")}
							className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
						>
							v1
						</Link>
						<a
							href="https://github.com/niapya/ai-sdk-x"
							target="_blank"
							rel="noopener noreferrer"
							className="hidden text-zinc-500 hover:text-zinc-900 dark:hover:text-white sm:inline"
						>
							GitHub
						</a>
					</nav>
				</div>
			</header>
			<main className="min-w-0 flex-1">{children}</main>
			<footer className="border-t border-zinc-200 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-950/40">
				<div className="mx-auto flex max-w-360 flex-col gap-3 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center">
					<p>AI SDK X documentation</p>
					<div className="sm:ml-auto sm:flex sm:items-center sm:gap-4">
						<Link href={withBasePath("/v1/")} className="hover:text-zinc-900 dark:hover:text-white">
							Get Started
						</Link>
						<a
							href="https://github.com/niapya/ai-sdk-x"
							target="_blank"
							rel="noopener noreferrer"
							className="hover:text-zinc-900 dark:hover:text-white"
						>
							GitHub
						</a>
					</div>
				</div>
			</footer>
		</div>
	);
}
