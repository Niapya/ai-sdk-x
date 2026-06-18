import type { SkillInstallTarget } from "@/features/skills/types";

const GITHUB_REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\.git)?$/;
const GIT_SSH_PATTERN = /^[^@/\s]+@[^:\s]+:.+$/;

export interface ParsedSkillInstallSpec {
	selector?: string;
	source: string;
}

export interface NormalizedSkillSource {
	cloneUrl?: string;
	preferredPath?: string;
	source: string;
	type: "github" | "gitlab" | "git" | "skills-sh" | "unknown";
}

export function parseSkillInstallTarget(spec: string): SkillInstallTarget | null {
	const parsed = parseSkillInstallSpec(spec);
	if (!parsed?.selector) {
		return null;
	}

	const normalized = normalizeSkillSource(parsed.source);
	if (!normalized.cloneUrl && normalized.type !== "unknown") {
		return null;
	}

	return {
		repoUrl: normalized.cloneUrl ?? normalized.source,
		selector: parsed.selector,
		...(normalized.preferredPath ? { sourcePath: normalized.preferredPath } : {}),
	};
}

export function parseSkillInstallSpec(spec: string): ParsedSkillInstallSpec | null {
	const trimmedSpec = spec.trim();
	if (!trimmedSpec) {
		return null;
	}

	const atIndex = findSelectorSeparator(trimmedSpec);
	if (atIndex === -1) {
		return { source: trimmedSpec };
	}

	const source = trimmedSpec.slice(0, atIndex);
	const selector = trimmedSpec.slice(atIndex + 1);
	if (!source || !isValidSelector(selector)) {
		return null;
	}

	return { source, selector };
}

export function normalizeSkillSource(source: string): NormalizedSkillSource {
	const trimmedSource = source.trim().replace(/\/+$/, "");
	if (GITHUB_REPO_PATTERN.test(trimmedSource)) {
		return {
			cloneUrl: `https://github.com/${trimmedSource.replace(/\.git$/i, "")}`,
			source: trimmedSource,
			type: "github",
		};
	}

	if (/^https:\/\/skills\.sh\/[^/\s]+$/i.test(trimmedSource)) {
		return { source: trimmedSource, type: "skills-sh" };
	}

	const github = normalizeHostedSource(trimmedSource, "github.com", "github");
	if (github) {
		return github;
	}

	const gitlab = normalizeHostedSource(trimmedSource, "gitlab.com", "gitlab");
	if (gitlab) {
		return gitlab;
	}

	if (isGitSource(trimmedSource)) {
		return { cloneUrl: trimmedSource, source: trimmedSource, type: "git" };
	}

	return { source: trimmedSource, type: "unknown" };
}

export function deriveSkillRepoSlug(repoUrl: string): string {
	const trimmedRepo = repoUrl.trim().replace(/\/+$/, "");
	if (!trimmedRepo) {
		return "repo";
	}

	if (GITHUB_REPO_PATTERN.test(trimmedRepo)) {
		return trimmedRepo.replace(/\.git$/i, "").replaceAll("/", "-");
	}

	const sshMatch = trimmedRepo.match(/^[^@]+@[^:]+:(.+)$/);
	if (sshMatch?.[1]) {
		return sshMatch[1].replace(/\.git$/i, "").replaceAll("/", "-");
	}

	try {
		const url = new URL(trimmedRepo);
		const pathname = url.pathname.replace(/^\/+/, "").replace(/\.git$/i, "");
		if (pathname) {
			return pathname.replaceAll("/", "-");
		}
	} catch {
		// Ignore URL parsing failures and fall back to path-like handling.
	}

	const segments = trimmedRepo
		.split(/[\\/]/)
		.map((segment) => segment.trim())
		.filter(Boolean);

	return segments.at(-1)?.replace(/\.git$/i, "") ?? "repo";
}

function normalizeHostedSource(
	source: string,
	host: string,
	type: "github" | "gitlab",
): NormalizedSkillSource | undefined {
	let url: URL;
	try {
		url = new URL(source);
	} catch {
		return undefined;
	}

	if (url.hostname !== host) {
		return undefined;
	}

	const segments = url.pathname.split("/").filter(Boolean);
	if (segments.length < 2) {
		return { source, type };
	}

	const owner = segments[0];
	const repo = segments[1].replace(/\.git$/i, "");
	const cloneUrl = `${url.protocol}//${host}/${owner}/${repo}`;
	const markerIndex = segments.findIndex((segment) => segment === "tree" || segment === "blob");
	if (markerIndex !== -1 && segments.length > markerIndex + 2) {
		const pathSegments = segments.slice(markerIndex + 2);
		if (segments[markerIndex] === "blob" && pathSegments.at(-1) === "SKILL.md") {
			pathSegments.pop();
		}

		return {
			cloneUrl,
			preferredPath: pathSegments.join("/"),
			source,
			type,
		};
	}

	return { cloneUrl, source, type };
}

function findSelectorSeparator(spec: string): number {
	for (let index = spec.length - 1; index > 0; index -= 1) {
		if (spec[index] !== "@") {
			continue;
		}

		const selector = spec.slice(index + 1);
		if (isValidSelector(selector)) {
			return index;
		}
	}

	return -1;
}

function isValidSelector(selector: string): boolean {
	return !!selector && !selector.includes("/") && !selector.includes("\\");
}

function isGitSource(source: string): boolean {
	return (
		source.endsWith(".git") ||
		source.startsWith("git://") ||
		source.startsWith("ssh://") ||
		source.startsWith("git+ssh://") ||
		GIT_SSH_PATTERN.test(source)
	);
}
