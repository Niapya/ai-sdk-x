import { defineConfig } from "vitepress";

export default defineConfig({
	title: "AI SDK X",
	description:
		"Environment-agnostic agent toolkit built on top of AI SDK. Build agents anywhere — local, server, or serverless.",
	base: "/ai-sdk-x/",

	head: [["link", { rel: "icon", href: "/ai-sdk-x/logo.svg" }]],

	themeConfig: {
		logo: "/logo.svg",
		nav: [
			{ text: "Guide", link: "/guide/getting-started" },
			{ text: "Packages", link: "/packages/execute" },
			{
				text: "v0.0.1",
				link: "https://github.com/niapya/ai-sdk-x",
			},
		],

		sidebar: [
			{
				text: "Guide",
				items: [{ text: "Getting Started", link: "/guide/getting-started" }],
			},
			{
				text: "Packages",
				items: [
					{ text: "@ai-sdk-x/execute", link: "/packages/execute" },
					{ text: "@ai-sdk-x/memo", link: "/packages/memo" },
					{ text: "@ai-sdk-x/memory", link: "/packages/memory" },
					{ text: "@ai-sdk-x/skill", link: "/packages/skill" },
				],
			},
		],

		socialLinks: [{ icon: "github", link: "https://github.com/niapya/ai-sdk-x" }],

		footer: {
			message: "Released under the MIT License.",
			copyright: "Copyright © 2026",
		},

		search: {
			provider: "local",
		},
	},
});
