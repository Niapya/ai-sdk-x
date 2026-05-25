import { navigate } from "@/router";

// Illustration: true horizontal left-to-right layout (matches hand-drawn sketch)
//
// Layout:
//   [X]         ↗  [Workspace]  →  [node:fs    ]
//              →  [Memory   ]  →  [AWS S3     ]
//              ↘  [Skills   ]  →  [Vercel Blob]
//
// Math (Tailwind):
//   Row box: h-16 (64px), row gap: gap-4 (16px)
//   Total height: 3×64 + 2×16 = 224px = h-56
//   Row centers (y): 32, 112, 192  |  fan-out origin: y=112

function MountIllustration() {
	const layerBox =
		"flex h-16 w-36 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white";
	const backendBox =
		"flex h-16 w-36 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-semibold text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-300";

	return (
		<div className="flex items-center justify-center gap-3 overflow-x-auto py-2 text-zinc-400 dark:text-zinc-600">
			{/* Col 1: X — full height wrapper so it centers against the 3 rows */}
			<div className="flex h-56 items-center">
				<div className="rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
					X
				</div>
			</div>

			{/* Col 2: Fan-out SVG — three lines from (0,112) to each row center */}
			<svg
				className="shrink-0"
				width="40"
				height="224"
				viewBox="0 0 40 224"
				fill="none"
				aria-hidden
			>
				<title>Connections from X to layers</title>
				<line x1="0" y1="112" x2="32" y2="32" stroke="currentColor" strokeWidth="1.5" />
				<line x1="0" y1="112" x2="32" y2="112" stroke="currentColor" strokeWidth="1.5" />
				<line x1="0" y1="112" x2="32" y2="192" stroke="currentColor" strokeWidth="1.5" />
				{/* arrowheads: tip at x=40, base at x=32 */}
				<polygon points="32,27 40,32 32,37" fill="currentColor" />
				<polygon points="32,107 40,112 32,117" fill="currentColor" />
				<polygon points="32,187 40,192 32,197" fill="currentColor" />
			</svg>

			{/* Col 3: Three layer rows */}
			<div className="flex flex-col gap-4">
				<div className={layerBox}>
					<span>📁</span>
					<span>Workspace</span>
				</div>
				<div className={layerBox}>
					<span>🧠</span>
					<span>Memory</span>
				</div>
				<div className={layerBox}>
					<span>🔧</span>
					<span>Skills</span>
				</div>
			</div>

			{/* Col 4: Three horizontal arrows → aligned with each row */}
			<div className="flex flex-col gap-4">
				<div className="flex h-16 w-6 items-center justify-center text-lg">→</div>
				<div className="flex h-16 w-6 items-center justify-center text-lg">→</div>
				<div className="flex h-16 w-6 items-center justify-center text-lg">→</div>
			</div>

			{/* Col 5: Three backend rows aligned with layers */}
			<div className="flex flex-col gap-4">
				<div className={backendBox}>node:fs</div>
				<div className={backendBox}>AWS S3</div>
				<div className={backendBox}>Vercel Blob</div>
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
						Three layers, any backend
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
