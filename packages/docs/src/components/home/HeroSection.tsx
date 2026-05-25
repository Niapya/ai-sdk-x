import logoUrl from "@/logo.svg";
import { navigate } from "@/router";

export function HeroSection() {
	return (
		<section className="relative py-28 text-center">
			<div className="pointer-events-none absolute inset-x-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-zinc-900/5 blur-3xl dark:bg-white/8" />
			<div className="relative mx-auto max-w-3xl px-6">
				<img src={logoUrl} alt="AI SDK X" className="mx-auto mb-6 h-16 w-16" />
				<h1 className="text-5xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-7xl">
					AI SDK X
				</h1>
				<p className="mx-auto mt-5 max-w-xl text-xl text-zinc-500 dark:text-zinc-400">
					Your AI SDK may only need this tool.
				</p>
				<div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
					<button
						type="button"
						className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-950/10 transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
						onClick={() => navigate("/v1/")}
					>
						Get Started
					</button>
					<a
						href="https://github.com/niapya/ai-sdk-x"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
					>
						View on GitHub
					</a>
				</div>
			</div>
		</section>
	);
}
