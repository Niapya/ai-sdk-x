import hljs from "highlight.js";
import { marked } from "marked";
import markedAlert from "marked-alert";
import { markedHighlight } from "marked-highlight";
import { useEffect, useState } from "react";

const markdown = marked
	.use(
		markedHighlight({
			langPrefix: "hljs language-",
			async: true,
			highlight(code, lang) {
				const language = hljs.getLanguage(lang) ? lang : "plaintext";

				return Promise.resolve(
					hljs.highlight(code, {
						language,
					}).value,
				);
			},
		}),
	)
	.use(markedAlert())
	.setOptions({
		gfm: true,
		breaks: true,
	});

export function Markdown({ content }: { content: string }) {
	const [html, setHtml] = useState("");

	useEffect(() => {
		let mounted = true;

		async function parse() {
			const parsed = await markdown.parse(content);

			if (mounted) {
				setHtml(parsed as string);
			}
		}

		parse();

		return () => {
			mounted = false;
		};
	}, [content]);

	return (
		<div className="markdown-body">
			<div
				// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown
				dangerouslySetInnerHTML={{
					__html: html,
				}}
			/>
		</div>
	);
}
