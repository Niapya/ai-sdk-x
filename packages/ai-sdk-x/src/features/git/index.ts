import { type Command, type ExecResult, latin1FromBytes } from "just-bash";
import { createGit } from "just-git";
import type { GitConfig, GitOptions } from "@/features/git/types";
import type { Feature } from "@/types";

export function createGitFeatureDescription(): string {
	return 'The git feature provides a just-git backed git command. Use git through the bash tool, not as a separate callable tool. Put the shell command in command, for example command="git status" or command="git log --oneline -5" with cwd set to the repository root. It supports a subset of real git commands including init, clone, fetch, push, pull, add, rm, mv, commit, status, log, show, diff, grep, blame, branch, tag, checkout, switch, restore, reset, merge, rebase, stash, remote, config, bisect, clean, reflog, rev-parse, and ls-files. Run git --help or git <subcommand> --help when unsure because each command implements a subset of real git flags. Only commit, amend, push, or create PR-related changes when explicitly requested. Before committing, inspect git status, git diff, and recent history; stage only intended files, never include secrets, and write a concise commit message matching the repository style.';
}

export function createGitFeature(option: boolean | GitOptions | undefined = true): Feature {
	const resolvedOption = typeof option === "object" ? option : undefined;
	const gitCommand = resolvedOption ? createGit(resolvedOption) : createGit();
	const config: GitConfig = {
		enabled: option !== false,
		...(resolvedOption ?? {}),
	};
	const feature: Feature = {
		name: "git",
	};

	if (!config.enabled) {
		return feature;
	}

	return {
		...feature,
		description: createGitFeatureDescription,
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
