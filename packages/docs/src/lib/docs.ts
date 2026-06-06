import fs from "node:fs";
import path from "node:path";

import {
	DOCS_VERSIONS,
	type DocMeta,
	type DocsVersion,
	type NavSection,
	type TocItem,
	toDocPath,
	versionInfo,
} from "@/lib/docs-data";
import { slugifyHeading } from "@/lib/markdown-heading";

export type { DocsVersion, NavSection, TocItem };
export { DOCS_VERSIONS, toDocPath, versionInfo };

const contentRoot = path.join(process.cwd(), "content");

export function getDocRoutes() {
	return DOCS_VERSIONS.flatMap((version) =>
		getMarkdownFiles(path.join(contentRoot, version)).map((filePath) => {
			const relative = path.relative(path.join(contentRoot, version), filePath);
			const slug = relative.replace(/\.mdx?$/, "").split(path.sep);
			return {
				version,
				slug: slug[0] === "index" ? [] : slug,
			};
		}),
	);
}

export function getDocMeta(version: DocsVersion, slug: string[] = []): DocMeta {
	const filePath = path.join(
		contentRoot,
		version,
		slug.length ? `${slug.join("/")}.md` : "index.md",
	);
	const source = fs.readFileSync(filePath, "utf8");
	const title = source.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? versionInfo[version].label;

	return {
		title,
		version,
		slug,
		path: toDocPath(version, slug),
		toc: extractToc(source),
	};
}

export function getVersionDocs(version: DocsVersion): NavSection[] {
	return versionInfo[version].sections;
}

function extractToc(source: string): TocItem[] {
	return source
		.split("\n")
		.map((line) => line.match(/^(##|###)\s+(.+)$/))
		.filter((match): match is RegExpMatchArray => Boolean(match))
		.map((match) => {
			const title = match[2].replace(/\s+#*$/, "").trim();
			return {
				depth: match[1].length as 2 | 3,
				title,
				href: `#${slugifyHeading(title)}`,
			};
		});
}

function getMarkdownFiles(directory: string): string[] {
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return getMarkdownFiles(entryPath);
		if (/\.mdx?$/.test(entry.name)) return [entryPath];
		return [];
	});
}
