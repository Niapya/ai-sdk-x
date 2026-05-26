import type { SkillInstallTarget } from "@/features/skills/types";

const GITHUB_REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(?:\.git)?$/;

export function parseSkillInstallTarget(spec: string): SkillInstallTarget | null {
	const atIndex = spec.lastIndexOf("@");
	if (atIndex <= 0 || atIndex === spec.length - 1) {
		return null;
	}

	const repoUrl = normalizeSkillRepoUrl(spec.slice(0, atIndex));
	const selector = spec.slice(atIndex + 1);

	if (!selector || selector.includes("/") || selector.includes("\\")) {
		return null;
	}

	return { repoUrl, selector };
}

export function normalizeSkillRepoUrl(repo: string): string {
	const trimmedRepo = repo.trim();
	if (GITHUB_REPO_PATTERN.test(trimmedRepo)) {
		return `https://github.com/${trimmedRepo.replace(/\.git$/i, "")}`;
	}

	return trimmedRepo;
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
