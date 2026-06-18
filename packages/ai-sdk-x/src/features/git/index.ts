import { createGit } from "just-git";
import type { GitConfig, GitOptions } from "@/features/git/types";
import type { Feature, FeatureInstructions } from "@/types";

export function createGitFeatureDescription(): FeatureInstructions {
	return {
		guidance: [
			"The Git command is on.",
			"Write a concise commit message matching the repository style.",
		].join("\n"),
	};
}

export function createGitFeature(option: boolean | GitOptions | undefined = true): Feature {
	const resolvedOption = typeof option === "object" ? option : undefined;
	const config: GitConfig = {
		enabled: option !== false,
		...(resolvedOption ?? {}),
	};

	if (!config.enabled) {
		return {
			name: "git",
		};
	}

	const gitCommand = createGit(resolvedOption);

	return {
		name: "git",
		description: createGitFeatureDescription,
		command: [
			{
				...gitCommand,
				trusted: true,
			},
		],
	};
}
