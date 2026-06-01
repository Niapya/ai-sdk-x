import type { DocsVersion } from "@/lib/docs-data";

const SITE_NAME = "AI SDK X";
const SITE_DESCRIPTION =
	"AI SDK X is a Bash runtime for AI agents with built-in Memory, Skills, Workspace, Patch, and WASM-backed JS/Python support.";
const BASE_URL = "https://niapya.github.io/ai-sdk-x";

type MetaInput = {
	title: string;
	description?: string;
	path?: string;
};

export function buildPageMetadata({
	title,
	description = SITE_DESCRIPTION,
	path = "/",
}: MetaInput) {
	const canonical = `${BASE_URL}${path}`;
	const fullTitle = title === SITE_NAME ? SITE_NAME : `${title} - ${SITE_NAME}`;

	return {
		title: fullTitle,
		description,
		canonical,
		openGraph: {
			title: fullTitle,
			description,
			url: canonical,
			siteName: SITE_NAME,
			type: "website" as const,
		},
		twitter: {
			card: "summary_large_image" as const,
			title: fullTitle,
			description,
		},
	};
}

export function buildDocDescription(title: string, version: DocsVersion): string {
	return `${title} documentation for AI SDK X ${version}.`;
}
