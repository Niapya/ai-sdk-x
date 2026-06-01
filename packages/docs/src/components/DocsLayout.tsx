import type { ReactNode } from "react";

import { Layout } from "@/components/Layout";
import { NavigationSidebar } from "@/components/NavigationSidebar";
import { NavigationSidebarMenu } from "@/components/NavigationSidebarMenu";
import { TocMenu } from "@/components/TocMenu";
import type { TocItem } from "@/lib/docs-data";

export function DocsLayout({
	children,
	currentPath,
	toc,
}: {
	children: ReactNode;
	currentPath: string;
	toc: TocItem[];
}) {
	return (
		<Layout>
			<div className="mx-auto grid max-w-360 grid-cols-1 gap-8 px-4 pt-6 pb-8 md:px-6 md:pt-8 md:pb-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:pb-12">
				<aside className="sticky top-20 hidden lg:block">
					<div className="-m-6 p-6">
						<NavigationSidebar currentPath={currentPath} />
					</div>
				</aside>
				<div className="min-w-0">
					<NavigationSidebarMenu currentPath={currentPath} />
					<TocMenu toc={toc} />
					<article className="docs-article markdown-body">{children}</article>
				</div>
			</div>
		</Layout>
	);
}
