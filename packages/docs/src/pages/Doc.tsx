import { Markdown } from "@/components/Markdown";
import { getContent } from "@/content";

export function Doc({ path }: { path: string }) {
	const content = getContent(path);

	if (!content) {
		return (
			<div className="py-16 text-center">
				<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Page not found</h1>
				<p className="mt-2 text-zinc-500">
					The page <code className="text-sm">{path}</code> does not exist.
				</p>
			</div>
		);
	}

	return <Markdown content={content} />;
}
