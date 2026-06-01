const GITHUB_PAGES_BASE_PATH = "/ai-sdk-x";

export function withBasePath(path: string): string {
	if (!path.startsWith("/")) return path;
	if (path === "/") return GITHUB_PAGES_BASE_PATH;
	return `${GITHUB_PAGES_BASE_PATH}${path}`;
}
