import { navigate } from "@/router";

export function FooterCta() {
	return (
		<section className="mx-auto max-w-6xl px-6 py-20">
			<div className="rounded-3xl border border-zinc-200 bg-zinc-50 px-8 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900">
				<h2 className="text-3xl font-semibold tracking-tight transition-all text-zinc-900 dark:text-white hover:font-extrabold">
					Ready to give your agent a shell?
				</h2>
				<p className="mx-auto mt-4 max-w-xl text-base text-zinc-600 dark:text-zinc-400">
					Drop{" "}
					<code className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-700">
						npm i ai-sdk-x
					</code>{" "}
					into your project and hand the AI a virtual Bash in three lines of code.
				</p>
				<div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
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
