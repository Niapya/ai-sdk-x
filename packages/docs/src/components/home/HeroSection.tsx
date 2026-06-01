"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/base-path";

const PROMPT = `First, search and install "frontend-design" Skills. Then, read it and implement a "Snake game" in the Workspace. Finally, summarise into Memory.`;

type OutputLine = { text: string; kind: "cmd" | "out" | "ok" | "think" };

const OUTPUT: OutputLine[] = [
	{ kind: "think", text: "I'll search for the frontend-design skill first." },
	{ kind: "cmd", text: "$ x-skills search frontend-design" },
	{ kind: "out", text: "  anthropics/skills@frontend-design (466.3K installs)" },
	{ kind: "out", text: "  pbakaus/impeccable@frontend-design (53.5K installs)" },
	{
		kind: "think",
		text: "466K installs — that's it - installing anthropics/skills@frontend-design.",
	},
	{ kind: "cmd", text: "$ x-skills install anthropics/skills@frontend-design" },
	{ kind: "ok", text: "  Installed frontend-design ✓" },
	{ kind: "think", text: "Reading the skill to understand the design guidelines." },
	{ kind: "cmd", text: "$ cat skills/frontend-design/SKILL.md" },
	{ kind: "out", text: "  Create distinctive, production-grade frontend interfaces..." },
	{ kind: "think", text: "Implementing a retro-futuristic neon Snake game with Canvas API." },
	{ kind: "cmd", text: "$ mkdir ~/workspace/snake-game && cd ~/workspace/snake-game" },
	{ kind: "cmd", text: "$ cat > index.html" },
	{ kind: "out", text: "  writing HTML skeleton + <canvas>..." },
	{ kind: "out", text: "  writing CSS: neon glow, dark theme..." },
	{ kind: "out", text: "  writing JS: snake logic, game loop..." },
	{ kind: "out", text: "  writing particle effects + score HUD..." },
	{ kind: "ok", text: "  847 lines written ✓" },
	{ kind: "think", text: "Summarizing the implementation into memory." },
	{ kind: "cmd", text: "$ cat snake-game-memory.txt | x-memory add" },
	{ kind: "out", text: "  /home/user/memory/daily/2026-05-27/memory.md" },
	{ kind: "ok", text: "✓ All tasks completed." },
];

// Delay (ms) before each output line appears
const LINE_DELAYS = [
	380, 200, 180, 150, 300, 200, 280, 300, 200, 180, 300, 200, 300, 200, 220, 240, 220, 350, 300,
	200, 200, 350,
];

function ReplAnimation() {
	const [inputLen, setInputLen] = useState(0);
	const [lines, setLines] = useState<OutputLine[]>([]);
	const bodyRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom as content streams in
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional re-run on data change
	useEffect(() => {
		if (bodyRef.current) {
			bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
		}
	}, [lines, inputLen]);

	useEffect(() => {
		const timers: ReturnType<typeof setTimeout>[] = [];
		let cancelled = false;

		function run() {
			if (cancelled) return;
			setInputLen(0);
			setLines([]);

			let t = 0;

			// Typewriter: one character every 20 ms (~2.9 s for the full prompt)
			for (let i = 1; i <= PROMPT.length; i++) {
				const n = i;
				timers.push(
					setTimeout(() => {
						if (!cancelled) setInputLen(n);
					}, t),
				);
				t += 20;
			}

			// Pause after the user "presses Enter"
			t += 600;

			// Stream output lines
			for (let i = 0; i < OUTPUT.length; i++) {
				const line = OUTPUT[i];
				timers.push(
					setTimeout(() => {
						if (!cancelled) setLines((prev) => [...prev, line]);
					}, t),
				);
				t += LINE_DELAYS[i] ?? 300;
			}
		}

		run();

		return () => {
			cancelled = true;
			for (const timer of timers) clearTimeout(timer);
		};
	}, []);

	return (
		<div className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-950 text-left shadow-2xl dark:border-zinc-800">
			{/* Traffic-light title bar */}
			<div className="flex items-center border-b border-zinc-800 px-4 py-3">
				<div className="flex items-center">
					<span className="h-3 w-3 rounded-full bg-red-500/80" />
					<span className="ml-1.5 h-3 w-3 rounded-full bg-yellow-500/80" />
					<span className="ml-1.5 h-3 w-3 rounded-full bg-green-500/80" />
				</div>
				<span className="ml-3 text-xs text-zinc-500">Agent REPL</span>
			</div>

			{/* Terminal body — fixed height so the page layout doesn't shift */}
			<div
				ref={bodyRef}
				className="h-105 overflow-y-auto p-5 font-mono text-xs leading-relaxed scrollbar-none"
			>
				{/* User prompt with typewriter */}
				<div className="flex gap-1">
					<span className="select-none whitespace-nowrap text-sky-400">you&gt;</span>
					<span className="break-all text-zinc-100">{PROMPT.slice(0, inputLen)}</span>
					{inputLen < PROMPT.length && <span className="animate-pulse text-zinc-100">▌</span>}
				</div>

				{/* Streaming output */}
				{lines.map((line, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: animation frames
						key={i}
						className={
							line.kind === "think"
								? "italic text-zinc-500"
								: line.kind === "cmd"
									? "text-emerald-400"
									: line.kind === "ok"
										? "text-emerald-300"
										: "text-zinc-400"
						}
					>
						{line.text}
					</div>
				))}

				{/* Next prompt cursor after animation completes */}
				{lines.length === OUTPUT.length && (
					<div className="mt-1 flex gap-1">
						<span className="select-none text-sky-400">you&gt;</span>
						<span className="animate-pulse text-zinc-100">▌</span>
					</div>
				)}
			</div>
		</div>
	);
}

export function HeroSection() {
	return (
		<section className="relative py-28 text-center">
			<div className="relative mx-auto max-w-3xl px-6">
				<Image src="/logo.svg" alt="AI SDK X" width={64} height={64} className="mx-auto mb-6" />
				<h1 className="text-5xl font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-7xl">
					AI SDK X
				</h1>
				<p className="mx-auto mt-5 max-w-xl text-xl text-zinc-500 dark:text-zinc-400">
					Your AI SDK may only need this tool.
				</p>
				<div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
					<Link
						href={withBasePath("/v1/")}
						className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-zinc-950/10 transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
					>
						Get Started
					</Link>
					<a
						href="https://github.com/niapya/ai-sdk-x"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
					>
						View on GitHub
					</a>
				</div>
				<ReplAnimation />
			</div>
		</section>
	);
}
