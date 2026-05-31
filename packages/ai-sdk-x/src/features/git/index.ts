import { type Command, type ExecResult, latin1FromBytes } from "just-bash";
import { createGit } from "just-git";
import type { GitConfig, GitOptions } from "@/features/git/types";
import type { Feature } from "@/types";

export function createGitFeatureDescription(): string {
	return [
		"The Git command is on.",
		"write a concise commit message matching the repository style.",
	].join("\n");
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
		command: [wrapGitCommand(gitCommand)],
	};
}

function wrapGitCommand(git: ReturnType<typeof createGit>): Command {
	return {
		name: git.name,
		execute: async (args, ctx) => {
			return (await git.execute(args, {
				...ctx,
				stdin: latin1FromBytes(ctx.stdin),
			})) as ExecResult;
		},
	};
}

export type { GitConfig, GitOptions } from "@/features/git/types";
