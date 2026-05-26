import { type Command, type ExecResult, latin1FromBytes } from "just-bash";
import { createGit } from "just-git";
import type { GitConfig, GitOptions } from "@/features/git/types";
import { resolveFeatureEnabled, resolveFeatureOption } from "@/runtime/features";
import type { Feature } from "@/types";

export function createGitFeature(option: boolean | GitOptions | undefined = true): Feature {
	const resolvedOption = resolveFeatureOption(option);
	const gitCommand = resolvedOption ? createGit(resolvedOption) : createGit();
	const config: GitConfig = {
		enabled: resolveFeatureEnabled(option),
		...(resolvedOption ?? {}),
	};
	const feature: Feature = {
		name: "git",
		prompt: () => "Use the git command to inspect or modify repository state.",
	};

	if (!config.enabled) {
		return feature;
	}

	return {
		...feature,
		command: [wrapGitCommand(gitCommand)],
	};
}

function wrapGitCommand(gitCommand: ReturnType<typeof createGit>): Command {
	return {
		name: gitCommand.name,
		execute: async (args, ctx) => {
			return (await gitCommand.execute(args, {
				...ctx,
				stdin: latin1FromBytes(ctx.stdin),
			})) as ExecResult;
		},
	};
}

export type { GitConfig, GitOptions } from "@/features/git/types";
