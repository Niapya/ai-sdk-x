import { type Command, latin1FromBytes, type ExecResult } from "just-bash";
import { createGit } from "just-git";
import type { FeatureSetupContext, FeatureSetupResult } from "@/features/shared";
import { resolveFeatureEnabled, resolveFeatureOption } from "@/features/shared";
import type { GitConfig, GitOptions } from "@/features/git/types";

export function setupGitFeature(
	_context: FeatureSetupContext,
	option: boolean | GitOptions | undefined,
): FeatureSetupResult<GitConfig> {
	const resolvedOption = resolveFeatureOption(option);
	const gitCommand = resolvedOption ? createGit(resolvedOption) : createGit();
	const config: GitConfig = {
		enabled: resolveFeatureEnabled(option),
		...(resolvedOption ?? {}),
	};

	return {
		command: config.enabled ? wrapGitCommand(gitCommand) : undefined,
		config,
		initPaths: [],
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
