import hljs from "highlight.js";

const CODE = `import { X } from "ai-sdk-x";
import { ToolLoopAgent } from "ai";

const bash = X.init();
const tools = await bash.getTools();

const agent = ToolLoopAgent({
  model: "gpt-5.5",
  tools,
  stopWhen: stepCountIs(20),
});

await agent.generate({
  prompt: \`
    First, search and install "frontend-design" Skills.

    Then, read it and implement a "Snake game" in the Workspace.

    Finally, summarise into Memory.\`
});`.trim();

const highlightedCode = hljs.highlight(CODE, { language: "typescript" }).value;

function CodeBlock() {
	return (
		<div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 shadow-2xl dark:border-zinc-800">
			<div className="flex items-center gap-1.5 border-b border-zinc-800 px-5 py-3">
				<span className="h-3 w-3 rounded-full bg-red-500/80" />
				<span className="h-3 w-3 rounded-full bg-yellow-500/80" />
				<span className="h-3 w-3 rounded-full bg-green-500/80" />
				<span className="ml-3 text-xs text-zinc-500">agent.ts</span>
			</div>
			<pre className="overflow-x-hidden whitespace-pre-wrap wrap-break-word p-5 font-mono text-xs leading-relaxed">
				<code
					className="hljs language-typescript"
					style={{ backgroundColor: "transparent", padding: 0 }}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted static code sample
					dangerouslySetInnerHTML={{ __html: highlightedCode }}
				/>
			</pre>
		</div>
	);
}

export function AiSdkSection() {
	return (
		<section className="mx-auto max-w-6xl px-6 py-20">
			<div className="grid items-center gap-12 lg:grid-cols-2">
				{/* text */}
				<div>
					<h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
						Integrate with AI SDK
					</h2>
					<p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
						AI SDK X is built on top of{" "}
						<a
							href="https://sdk.vercel.ai/"
							target="_blank"
							rel="noopener noreferrer"
							className="underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
						>
							Vercel AI SDK
						</a>
						. Call
						<code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
							bash.getTools()
						</code>
						and pass the result directly into
						<code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
							generateText
						</code>
						,
						<code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs dark:bg-zinc-800">
							streamText
						</code>
						.
					</p>
					<ul className="mt-5 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
						{[
							"Works with every model provider in the AI SDK",
							"Multi-step tool calls via maxSteps",
							"Memory and Skills available as shell commands inside each call",
						].map((item) => (
							<li key={item} className="flex items-start gap-2.5">
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
								{item}
							</li>
						))}
					</ul>
				</div>
				{/* code */}
				<div>
					<CodeBlock />
				</div>
			</div>
		</section>
	);
}
