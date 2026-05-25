import { navigate } from "@/router";

// Illustration: horizontal flow (BashTool → 3 vertical stacks, each with layer + backend)

function MountIllustration() {
	return (
		<div className="w-full overflow-x-auto">
			<div className="flex items-start gap-6 justify-center min-w-max px-4 py-2">
				{/* BashTool (left) */}
				<div className="flex-shrink-0">
					<div className="rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-900 w-36 text-center">
						BashTool
					</div>
				</div>

				{/* Three vertical stacks (Workspace, Memory, Skills) */}
				<div className="flex gap-8">
					{/* Stack 1: Workspace → node:fs */}
					<div className="flex flex-col items-center gap-3">
						<svg
							width="28"
							height="24"
							viewBox="0 0 28 24"
							fill="none"
							aria-hidden
							className="text-zinc-400"
						>
							<title>Arrow right</title>
							<line x1="0" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" />
							<path
								d="M18 8l4 4-4 4"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900 w-40">
							<div className="text-xl">📁</div>
							<div className="mt-1 font-semibold text-sm">Workspace</div>
							<div className="mt-2 text-xs text-zinc-500">project files</div>
						</div>
						<svg
							width="24"
							height="28"
							viewBox="0 0 24 28"
							fill="none"
							aria-hidden
							className="text-zinc-400"
						>
							<title>Arrow down</title>
							<line x1="12" y1="0" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5" />
							<path
								d="M8 18l4 4 4-4"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center dark:border-zinc-800 dark:bg-zinc-950/40 w-40">
							<div className="font-semibold text-sm">node:fs</div>
							<div className="mt-1 text-xs text-zinc-500">local filesystem</div>
						</div>
					</div>

					{/* Stack 2: Memory → AWS S3 */}
					<div className="flex flex-col items-center gap-3">
						<svg
							width="28"
							height="24"
							viewBox="0 0 28 24"
							fill="none"
							aria-hidden
							className="text-zinc-400"
						>
							<title>Arrow right</title>
							<line x1="0" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" />
							<path
								d="M18 8l4 4-4 4"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900 w-40">
							<div className="text-xl">🧠</div>
							<div className="mt-1 font-semibold text-sm">Memory</div>
							<div className="mt-2 text-xs text-zinc-500">x-memory list · add · search</div>
						</div>
						<svg
							width="24"
							height="28"
							viewBox="0 0 24 28"
							fill="none"
							aria-hidden
							className="text-zinc-400"
						>
							<title>Arrow down</title>
							<line x1="12" y1="0" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5" />
							<path
								d="M8 18l4 4 4-4"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center dark:border-zinc-800 dark:bg-zinc-950/40 w-40">
							<div className="font-semibold text-sm">AWS S3</div>
							<div className="mt-1 text-xs text-zinc-500">object storage</div>
						</div>
					</div>

					{/* Stack 3: Skills → Vercel blob */}
					<div className="flex flex-col items-center gap-3">
						<svg
							width="28"
							height="24"
							viewBox="0 0 28 24"
							fill="none"
							aria-hidden
							className="text-zinc-400"
						>
							<title>Arrow right</title>
							<line x1="0" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5" />
							<path
								d="M18 8l4 4-4 4"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<div className="rounded-xl border border-zinc-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900 w-40">
							<div className="text-xl">🔧</div>
							<div className="mt-1 font-semibold text-sm">Skills</div>
							<div className="mt-2 text-xs text-zinc-500">x-skills install · list</div>
						</div>
						<svg
							width="24"
							height="28"
							viewBox="0 0 24 28"
							fill="none"
							aria-hidden
							className="text-zinc-400"
						>
							<title>Arrow down</title>
							<line x1="12" y1="0" x2="12" y2="20" stroke="currentColor" strokeWidth="1.5" />
							<path
								d="M8 18l4 4 4-4"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center dark:border-zinc-800 dark:bg-zinc-950/40 w-40">
							<div className="font-semibold text-sm">Vercel blob</div>
							<div className="mt-1 text-xs text-zinc-500">serverless storage</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export function MountSection() {
	return (
		<section className="mx-auto max-w-6xl px-6 py-20">
			<div className="grid items-start gap-12 lg:grid-cols-2">
				{/* text */}
				<div className="lg:pt-4">
					<p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
						Memory · Skills · Workspace
					</p>
					<h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
						Three layers. Any backend.
					</h2>
					<p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
						Memory, Skills, and Workspace are virtual filesystems that mount into the shell at
						well-known paths. Each layer can be independently backed by a different storage driver —
						local disk, Amazon S3, Cloudflare R2, Vercel Blob, or any storage driver.
					</p>
					<p className="mt-3 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
						Skills support one-line installs straight from a Git repository. Memory has built-in
						commands for long-term and daily notes that the agent can call directly from the shell.
					</p>
					<div className="mt-7 flex flex-col gap-3 sm:flex-row">
						<button
							type="button"
							className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
							onClick={() => navigate("/v1/guide/getting-started")}
						>
							Read the guide
						</button>
					</div>
				</div>
				{/* illustration */}
				<div>
					<MountIllustration />
				</div>
			</div>
		</section>
	);
}
