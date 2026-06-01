import type { GetStaticPaths, GetStaticPropsContext, InferGetStaticPropsType } from "next";
import dynamic from "next/dynamic";
import Head from "next/head";

import { DocsLayout } from "@/components/DocsLayout";
import { Toc } from "@/components/Toc";
import { getDocMeta, getDocRoutes } from "@/lib/docs";
import { buildDocDescription, buildPageMetadata } from "@/lib/metadata";
import { DOCS_VERSIONS, type DocsVersion, toDocPath } from "@/lib/docs-data";

type Params = {
	version: DocsVersion;
	slug?: string[];
};

export const getStaticPaths = (async () => {
	return {
		paths: getDocRoutes().map((route) => ({
			params: {
				version: route.version,
				slug: route.slug,
			},
		})),
		fallback: false,
	};
}) satisfies GetStaticPaths<Params>;

export async function getStaticProps(context: GetStaticPropsContext<Params>) {
	const version = context.params?.version;
	const slug = context.params?.slug ?? [];

	if (!version || !DOCS_VERSIONS.includes(version)) {
		return { notFound: true };
	}

	const meta = getDocMeta(version, slug);

	return {
		props: {
			meta,
		},
	};
}

export default function DocPage({ meta }: InferGetStaticPropsType<typeof getStaticProps>) {
	const slugPath = meta.slug.length === 0 ? "index" : meta.slug.join("/");
	const Markdown = dynamic(() => import(`../../../content/${meta.version}/${slugPath}.md`));
	const metadata = buildPageMetadata({
		title: meta.title,
		description: buildDocDescription(meta.title, meta.version),
		path: meta.path,
	});

	return (
		<>
			<Head>
				<title>{metadata.title}</title>
				<meta name="description" content={metadata.description} />
				<link rel="canonical" href={metadata.canonical} />
				<meta property="og:title" content={metadata.openGraph.title} />
				<meta property="og:description" content={metadata.openGraph.description} />
				<meta property="og:url" content={metadata.openGraph.url} />
				<meta property="og:site_name" content={metadata.openGraph.siteName} />
				<meta property="og:type" content={metadata.openGraph.type} />
				<meta name="twitter:card" content={metadata.twitter.card} />
				<meta name="twitter:title" content={metadata.twitter.title} />
				<meta name="twitter:description" content={metadata.twitter.description} />
			</Head>
			<DocsLayout currentPath={toDocPath(meta.version, meta.slug)} toc={meta.toc}>
				<div>
					<Markdown />
				</div>
				<aside className="docs-toc">
					<Toc toc={meta.toc} />
				</aside>
			</DocsLayout>
		</>
	);
}
