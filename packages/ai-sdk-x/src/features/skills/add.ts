import { type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import {
	collectSkillFiles,
	toSkillsHomePath,
	writeSkillIndexEntry,
} from "@/features/skills/utils/lockfile";
import {
	frontmatterDescription,
	frontmatterName,
	stringifyFrontmatter,
} from "@/features/skills/utils/metadata";
import { commandError, defineCliCommand } from "@/utils/command";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";
import { resolveCliPath } from "@/utils/path";

export interface AddSkillInput {
	file?: string;
	skillName?: string;
	stdin?: boolean;
}

export async function addSkill(
	input: AddSkillInput,
	ctx: CommandContext,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	if (input.stdin && input.file) {
		return commandError("x-skills add: use --stdin or --file, not both\n", 1);
	}

	const source = await readSkillMarkdown(input.file, ctx);
	if ("error" in source) {
		return source.error;
	}

	const { frontmatter } = parseMarkdownFrontmatter(source.markdown);
	const name = sanitizeSkillName(input.skillName || frontmatterName(frontmatter));
	const description = frontmatterDescription(frontmatter).trim();
	if (!name || !description) {
		return commandError(
			"x-skills add: local skills require frontmatter metadata with name and description\n",
			1,
		);
	}

	const destinationPath = ctx.fs.resolvePath(options.mountPoint, name);
	const skillPath = ctx.fs.resolvePath(destinationPath, "SKILL.md");
	await ctx.fs.rm(destinationPath, { force: true, recursive: true });
	await ctx.fs.mkdir(destinationPath, { recursive: true });
	await ctx.fs.writeFile(skillPath, source.markdown);
	const files = await collectSkillFiles(ctx.fs, destinationPath);

	if (options.lockfile) {
		await writeSkillIndexEntry(ctx.fs, options, {
			description,
			files,
			frontmatter: stringifyFrontmatter(frontmatter),
			skillPath,
			source: "local",
			target: {
				repoUrl: "",
				selector: name,
			},
		});
	}

	const outputSkillPath = options.lockfile
		? toSkillsHomePath(ctx.fs, options.mountPoint, skillPath)
		: skillPath;
	return {
		stdout: `${[
			`added\t${name}`,
			`description\t${description}`,
			`source\tlocal`,
			`skillPath\t${outputSkillPath}`,
			`files\t${files.length}`,
		].join("\n")}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createAddSkillCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "add",
		type: "command",
		summary: "Add a local skill from stdin or a markdown file.",
		description:
			"Local skills are managed through this command so the skills index stays accurate. The skill markdown must include frontmatter metadata with name and description.",
		usage: "x-skills add [skillName] [--stdin|--file <path>]",
		args: [
			{
				name: "skillName",
				summary: "Optional installed skill name. Defaults to frontmatter name.",
			},
		],
		flags: {
			file: {
				description: "Read the skill markdown from a file path instead of stdin.",
				type: "string",
			},
			stdin: {
				description: "Read the skill markdown from stdin.",
				type: "boolean",
			},
		},
		examples: [
			{ command: "x-skills add --file ./SKILL.md" },
			{
				command:
					"printf '%s' '---\\nname: demo\\ndescription: Demo\\n---\\n' | x-skills add --stdin",
			},
		],
		run: ({ args: { skillName }, flags: { file, stdin } }, ctx) =>
			addSkill({ file, skillName, stdin }, ctx, options),
	});
}

async function readSkillMarkdown(
	file: string | undefined,
	ctx: CommandContext,
): Promise<{ markdown: string } | { error: ExecResult }> {
	if (!file) {
		const markdown = decodeBytesToUtf8(ctx.stdin);
		if (!markdown.trim()) {
			return { error: commandError("x-skills add: stdin is empty\n", 1) };
		}
		return { markdown };
	}

	const path = resolveCliPath(file, ctx);
	if (!(await ctx.fs.exists(path))) {
		return { error: commandError(`x-skills add: file not found: ${file}\n`, 1) };
	}

	return { markdown: await ctx.fs.readFile(path) };
}

function sanitizeSkillName(name: string): string {
	return name.trim().replace(/[\\/]+/g, "-");
}
