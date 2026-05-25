type Line = { prompt: boolean; text: string; blink?: boolean };

const LINES: Line[] = [
	{ prompt: true, text: "ls ~/workspace" },
	{ prompt: false, text: "project.md  notes.md  plan.md" },
	{ prompt: true, text: 'echo "hello from virtual bash"' },
	{ prompt: false, text: "hello from virtual bash" },
	{ prompt: true, text: 'printf "remember this" | x-memory add reminder' },
	{ prompt: false, text: "/home/user/memory/daily/2026-05-24/reminder.md" },
	{ prompt: true, text: "js-exec -c 'const x = 2 ** 10; print(x)'" },
	{ prompt: false, text: "1024" },
	{ prompt: true, text: "▌", blink: true },
];

function Check() {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="none"
			className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
			aria-hidden="true"
		>
			<path
				d="M3 8l3.5 3.5L13 4"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function TerminalIllustration() {
	return (
		<div className="rounded-2xl border border-zinc-200 bg-zinc-950 p-5 font-mono text-xs leading-relaxed shadow-2xl dark:border-zinc-800">
			<div className="mb-4 flex items-center gap-1.5">
				<span className="h-3 w-3 rounded-full bg-red-500/80" />
				<span className="h-3 w-3 rounded-full bg-yellow-500/80" />
				<span className="h-3 w-3 rounded-full bg-green-500/80" />
				<span className="ml-3 text-zinc-500">REPL</span>
			</div>
			{LINES.map((line, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static list
					key={i}
					className="flex gap-2"
				>
					<span className={`select-none ${line.prompt ? "text-emerald-400" : "text-zinc-600"}`}>
						{line.prompt ? "$" : "›"}
					</span>
					<span className={line.prompt ? "text-zinc-100" : "text-zinc-400"}>
						{line.blink ? <span className="animate-pulse">{line.text}</span> : line.text}
					</span>
				</div>
			))}
		</div>
	);
}

export function BashSection() {
	return (
		<section className="mx-auto max-w-6xl px-6 py-20">
			<div className="grid items-center gap-12 lg:grid-cols-2">
				<div className="order-2 lg:order-1">
					<TerminalIllustration />
				</div>
				<div className="order-1 lg:order-2">
					<p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
						Virtual Bash
					</p>
					<h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
						Bash is everything
					</h2>
					<p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
						In the age of AI agents, Bash is everything — so we built a virtual Bash.
					</p>
					<ul className="mt-5 space-y-2.5">
						{[
							"curl networking — call any HTTP endpoint from the agent shell",
							"js-exec (QuickJS WASM) — fast, sandboxed JavaScript without Node.js",
							"Full POSIX shell — ls, cat, grep, sed, awk, pipes, redirects",
							"Composable — register your own commands alongside the built-ins",
						].map((item) => (
							<li
								key={item}
								className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-400"
							>
								<Check />
								{item}
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	);
}
