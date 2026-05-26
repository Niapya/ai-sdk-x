import type { CommandContext, ExecResult } from "just-bash";
import { deriveSkillRepoSlug } from "@/features/skills/utils/parser";
import { commandError } from "@/utils/command";

const SKILLS_TEMP_ROOT = "/tmp/skills";

export async function cloneSkillRepository(
	repoUrl: string,
	ctx: CommandContext,
): Promise<{ clonePath: string; result: ExecResult }> {
	const clonePath = ctx.fs.resolvePath(SKILLS_TEMP_ROOT, deriveSkillRepoSlug(repoUrl));

	await ctx.fs.mkdir(SKILLS_TEMP_ROOT, { recursive: true });
	await ctx.fs.rm(clonePath, { force: true, recursive: true });

	return {
		clonePath,
		result: await execGit(ctx, `clone ${quoteForShell(repoUrl)} ${quoteForShell(clonePath)}`),
	};
}

export async function execGit(ctx: CommandContext, args: string, cwd = "/"): Promise<ExecResult> {
	if (!ctx.exec) {
		return commandError("x-skills: git execution is unavailable\n", 1);
	}

	return ctx.exec(`git ${args}`, { cwd });
}

export function quoteForShell(value: string): string {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
