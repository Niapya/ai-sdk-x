import createMDX from "@next/mdx";
import remarkGfm from "remark-gfm";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";

const withMDX = createMDX({
	extension: /\.mdx?$/,
	options: {
		remarkPlugins: [remarkGfm],
	},
});

/** @type {import('next').NextConfig} */
const nextConfig = {
	basePath: isGithubActions ? "/ai-sdk-x" : undefined,
	images: {
		unoptimized: true,
	},
	output: "export",
	pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
	trailingSlash: true,
};

export default withMDX(nextConfig);
