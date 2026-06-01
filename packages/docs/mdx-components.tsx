import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";

import { CodeBlock } from "@/components/CodeBlock";
import { getTextContent, slugifyHeading } from "@/lib/markdown-heading";

const components: MDXComponents = {
	h2: ({ children, ...props }: ComponentPropsWithoutRef<"h2">) => (
		<h2 {...props} id={slugifyHeading(getTextContent(children))}>
			{children}
		</h2>
	),
	h3: ({ children, ...props }: ComponentPropsWithoutRef<"h3">) => (
		<h3 {...props} id={slugifyHeading(getTextContent(children))}>
			{children}
		</h3>
	),
	pre: ({ children }) => <>{children}</>,
	code: (props: ComponentPropsWithoutRef<"code">) => {
		const isInline = !props.className?.includes("language-");
		if (isInline) {
			return <code {...props} />;
		}
		return <CodeBlock className={props.className}>{props.children}</CodeBlock>;
	},
};

export function useMDXComponents(): MDXComponents {
	return components;
}
