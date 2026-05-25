import { marked } from "marked";
import { useMemo } from "react";

export function Markdown({ content }: { content: string }) {
	const html = useMemo(() => marked.parse(content, { async: false }), [content]);

	return (
		<div
			className="prose prose-zinc max-w-none dark:prose-invert"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: trusted markdown content
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
