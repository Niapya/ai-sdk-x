import hljs from "highlight.js";
import type { ReactNode } from "react";

import { CopyCodeButton } from "@/components/CopyCodeButton";

export function CodeBlock({ children, className }: { children?: ReactNode; className?: string }) {
	const code = String(children ?? "").replace(/\n$/, "");
	const language = className?.match(/language-([\w-]+)/)?.[1] ?? "text";
	const normalizedLanguage = hljs.getLanguage(language) ? language : "text";
	const highlighted =
		normalizedLanguage === "text"
			? escapeHtml(code)
			: hljs.highlight(code, { language: normalizedLanguage }).value;

	return (
		<div className="markdown-code-block">
			<div className="markdown-code-toolbar">
				<div className="flex items-center gap-2">
					<span className="markdown-code-language">{getLanguageLabel(normalizedLanguage)}</span>
					<span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-500">
						Code
					</span>
				</div>
				<CopyCodeButton code={code} />
			</div>
			<pre>
				<code
					className={`hljs language-${normalizedLanguage}`}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted mdx code block
					dangerouslySetInnerHTML={{ __html: highlighted }}
				/>
			</pre>
		</div>
	);
}

function getLanguageLabel(language: string): string {
	if (language === "text") return "plain text";
	return language;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
