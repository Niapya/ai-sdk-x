/**
 * Normalize a virtual filesystem path to an absolute, slash-trimmed form.
 */
export function normalizePath(path: string): string {
	if (!path || path === "/") {
		return "/";
	}

	let normalized = path;
	if (!normalized.startsWith("/")) {
		normalized = `/${normalized}`;
	}
	if (normalized.endsWith("/") && normalized !== "/") {
		normalized = normalized.slice(0, -1);
	}

	const segments = normalized.split("/").filter((segment) => segment && segment !== ".");
	const resolvedSegments: string[] = [];

	for (const segment of segments) {
		if (segment === "..") {
			resolvedSegments.pop();
			continue;
		}

		resolvedSegments.push(segment);
	}

	return `/${resolvedSegments.join("/")}`;
}

/**
 * Reject paths that contain null bytes before passing them to a filesystem.
 */
export function validatePath(path: string, operation: string): void {
	if (path.includes("\0")) {
		throw new Error(`ENOENT: path contains null byte, ${operation} '${path}'`);
	}
}

/**
 * Return the parent directory for a virtual path.
 */
export function dirname(path: string): string {
	const normalized = normalizePath(path);
	if (normalized === "/") {
		return "/";
	}

	const lastSlash = normalized.lastIndexOf("/");
	return lastSlash <= 0 ? "/" : normalized.slice(0, lastSlash);
}

/**
 * Join a parent path and child name using virtual path semantics.
 */
export function joinPath(parent: string, child: string): string {
	return normalizePath(parent === "/" ? `/${child}` : `${parent}/${child}`);
}

/**
 * Resolve a relative path against a base virtual path.
 */
export function resolvePath(base: string, path: string): string {
	if (path.startsWith("/")) {
		return normalizePath(path);
	}

	return normalizePath(base === "/" ? `/${path}` : `${base}/${path}`);
}

/**
 * Resolve a symlink target relative to the symlink's containing directory.
 */
export function resolveSymlinkTarget(symlinkPath: string, target: string): string {
	if (target.startsWith("/")) {
		return normalizePath(target);
	}

	return normalizePath(joinPath(dirname(symlinkPath), target));
}

/**
 * Collect parent directories from the nearest ancestor back to root.
 */
export function parentPaths(path: string): string[] {
	const normalized = normalizePath(path);
	if (normalized === "/") {
		return [];
	}

	const parents: string[] = [];
	let current = dirname(normalized);

	while (true) {
		parents.push(current);
		if (current === "/") {
			return parents;
		}
		current = dirname(current);
	}
}

/**
 * Build a prefix that matches descendants of the given path.
 */
export function descendantPrefix(path: string): string {
	const normalized = normalizePath(path);
	return normalized === "/" ? "/" : `${normalized}/`;
}
