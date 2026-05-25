const TARGETS = [
	{ label: "NodeJS", desc: "Runs in-process on Node.js" },
	{ label: "Vercel", desc: "Edge & Serverless Functions, no cold-start penalty" },
	{ label: "Cloudflare Workers", desc: "Edge-native, bring KV / R2 / D1 as your storage" },
	{ label: "Any JS runtime", desc: "Bun, Deno, AWS Lambda — pure ESM, no platform lock-in" },
];

export function DeploySection() {
	return (
		<section className="mx-auto max-w-6xl px-6 py-20">
			<div className="mb-10">
				<p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Deployment</p>
				<h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
					Runs wherever your stack lives
				</h2>
				<p className="mt-3 max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
					Pure ESM, no native binaries. Drop it into any JavaScript runtime.
				</p>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{TARGETS.map((t) => (
					<div
						key={t.label}
						className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
					>
						<p className="mb-1 text-xs font-semibold text-zinc-800 dark:text-zinc-200">{t.label}</p>
						<p className="text-xs leading-relaxed text-zinc-500">{t.desc}</p>
					</div>
				))}
			</div>
		</section>
	);
}
