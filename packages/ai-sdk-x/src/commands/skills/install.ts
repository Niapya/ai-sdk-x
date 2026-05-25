import type { CommandContext, ExecResult } from "just-bash";
import { createGit } from "just-git";
import type { SkillsCommandOptions } from "@/commands/skills/types";
import { writeSkillLockfile } from "@/commands/skills/utils/lockfile";
import { frontmatterDescription } from "@/commands/skills/utils/metadata";
import { parseSkillInstallTarget } from "@/commands/skills/utils/parser";
import { commandError, defineCliCommand } from "@/utils/command";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";

export async function installSkill(
	spec: string,
	ctx: CommandContext,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	if (!spec) {
		return commandError("x-skills install: missing <repo-url>@<skill-name>\n", 1);
	}

	const target = parseSkillInstallTarget(spec);
	if (!target) {
		return commandError(
			"x-skills install: expected <repo-url>@<skill-name>; installing an entire repository is not supported\n",
			1,
		);
	}

	const installId = `${Date.now()}-${target.selector}`;
	const cloneWorkspace = ctx.fs.resolvePath("/tmp/x-skills", installId);
	const cloneRoot = ctx.fs.resolvePath(cloneWorkspace, "repo");
	const sourcePath = ctx.fs.resolvePath(cloneRoot, `skills/${target.selector}`);
	const skillFilePath = ctx.fs.resolvePath(sourcePath, "SKILL.md");
	const destinationPath = ctx.fs.resolvePath(options.mountPoint, target.selector);

	try {
		await ctx.fs.rm(cloneWorkspace, { force: true, recursive: true });
		await ctx.fs.mkdir(cloneRoot, { recursive: true });

		const git = createGit({
			fs: ctx.fs,
			cwd: "/tmp",
			identity: { name: "AI SDK X", email: "ai-sdk-x@example.local" },
		});
		const clone = await git.exec(`clone ${quoteForGit(target.repoUrl)} ${quoteForGit(cloneRoot)}`);
		if (clone.exitCode !== 0) {
			return clone;
		}

		if (!(await ctx.fs.exists(skillFilePath))) {
			return commandError(
				`x-skills install: missing ${ctx.fs.resolvePath("/skills", `${target.selector}/SKILL.md`)} in ${target.repoUrl}\n`,
				1,
			);
		}

		const markdown = await ctx.fs.readFile(skillFilePath);
		const { frontmatter } = parseMarkdownFrontmatter(markdown);
		const description = frontmatterDescription(frontmatter);

		await ctx.fs.rm(destinationPath, { force: true, recursive: true });
		await ctx.fs.cp(sourcePath, destinationPath, { recursive: true });

		if (options.lockfile) {
			await writeSkillLockfile(ctx.fs, options, target, frontmatter, description);
		}

		await options.cache?.delete("skills:list");

		return {
			stdout: `Installed ${target.selector} from ${target.repoUrl}\n`,
			stderr: "",
			exitCode: 0,
		};
	} finally {
		await ctx.fs.rm(cloneWorkspace, { force: true, recursive: true });
	}
}

function quoteForGit(value: string): string {
	return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

export function createInstallSkillCommand(options: SkillsCommandOptions) {
	return defineCliCommand({
		id: "install",
		type: "command",
		summary: "Install a skill from a repository selector.",
		usage: "x-skills install <repo-url@skill-name>",
		args: [
			{
				name: "spec",
				required: true,
				summary: "Repository URL with the skill selector suffix.",
			},
		],
		examples: [
			{
				command:
					"x-skills install https://github.com/vercel-labs/agent-skills@vercel-composition-patterns",
			},
		],
		run: ({ args: { spec } }, ctx) => installSkill(spec, ctx, options),
	});
}
