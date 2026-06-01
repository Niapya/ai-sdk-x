import Head from "next/head";

import { Home } from "@/components/Home";
import { Layout } from "@/components/Layout";
import { buildPageMetadata } from "@/lib/metadata";

export default function HomePage() {
	const metadata = buildPageMetadata({
		title: "AI SDK X",
		path: "/",
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
			<Layout>
				<Home />
			</Layout>
		</>
	);
}
