import { navigate } from "@/router";

// Each layer maps to its own set of storage backend chips
const LAYERS = [
	{
		icon: "🧠",
		label: "Memory",
		commands: ["x-memory list", "x-memory add <title>", "x-memory search <query>"],
		backends: ["Local FS", "Amazon S3", "Cloudflare R2"],
	},
	{
		icon: "🔧",
		label: "Skills",
		commands: ["x-skills list", "x-skills install <repo>@<name>", "x-skills update"],
		backends: ["Local FS", "Vercel Blob"],
	},
	{
		icon: "📁",
		label: "Workspace",
		commands: [],
		backends: ["Local FS", "Amazon S3", "Cloudflare R2", "Vercel Blob"],
	},
];

function ArrowDown() {
	return (
		<div className="flex justify-center">
			<svg
				width="20"
				height="20"
				viewBox="0 0 20 20"
				fill="none"
				aria-hidden="true"
				className="text-zinc-300 dark:text-zinc-700"
			>
				<line x1="10" y1="0" x2="10" y2="12" stroke="currentColor" strokeWidth="1.5" />
				<path
					d="M5 9l5 7 5-7"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		</div>
	);
}

function MountIllustration() {
	return (
		<div className="space-y-3">
			{LAYERS.map((layer) => (
				<div key={layer.label}>
					{/* layer card */}
					<div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
						<div className="flex items-center gap-2.5">
							<span className="text-xl">{layer.icon}</span>
							<span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
								{layer.label}
							</span>
						</div>
						{layer.commands.length > 0 && (
							<div className="mt-2.5 flex flex-wrap gap-1.5">
								{layer.commands.map((cmd) => (
									<code
										key={cmd}
										className="rounded bg-zinc-100 px-2 py-0.5 font-mono text-[11px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
									>
										{cmd}
									</code>
								))}
							</div>
						)}
					</div>

					{/* arrow */}
					<ArrowDown />

					{/* backends */}
					<div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
						<div className="flex flex-wrap gap-1.5">
							{layer.backends.map((b) => (
								<span
									key={b}
									className="rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
								>
									{b}
								</span>
							))}
							<span className="rounded-full border border-dashed border-zinc-300 px-2.5 py-0.5 text-[11px] text-zinc-400 dark:border-zinc-700">
								+ any storage driver
							</span>
						</div>
					</div>
				</div>
			))}
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
