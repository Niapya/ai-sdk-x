"use client";

import { useState } from "react";

export function CopyCodeButton({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	async function handleCopy() {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1200);
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			className="markdown-code-copy"
			data-copied={copied ? "true" : "false"}
		>
			{copied ? "Copied" : "Copy"}
		</button>
	);
}
