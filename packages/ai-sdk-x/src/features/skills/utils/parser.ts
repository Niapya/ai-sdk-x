import type { SkillInstallTarget } from "@/features/skills/types";

export function parseSkillInstallTarget(spec: string): SkillInstallTarget | null {
	const atIndex = spec.lastIndexOf("@");
	if (atIndex <= "https://".length || atIndex === spec.length - 1) {
		return null;
	}

	const repoUrl = spec.slice(0, atIndex);
	const selector = spec.slice(atIndex + 1);

	if (!selector || selector.includes("/") || selector.includes("\\")) {
		return null;
	}

	return { repoUrl, selector };
}
