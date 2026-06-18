import type { CommandContext, ExecResult } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import {
	collectSkillFiles,
	findSkillMarkdownFile,
	toSkillsHomePath,
	upsertSkillIndexEntry,
} from "@/features/skills/utils/lockfile";
import {
	frontmatterDescription,
	frontmatterName,
	stringifyFrontmatter,
} from "@/features/skills/utils/metadata";
import { renderSkillMetadata } from "@/features/skills/utils/output";
import { commandError, defineCliCommand } from "@/utils/command";
import { parseMarkdownFrontmatter } from "@/utils/frontmatter";
import { resolveCliPath } from "@/utils/path";

export interface ImportSkillInput {
	path: string;
	skillName?: string;
}

export async function importSkill(
	input: ImportSkillInput,
	ctx: CommandContext,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	const sourcePath = resolveCliPath(input.path, ctx);
	if (!(await ctx.fs.exists(sourcePath))) {
		return commandError(`x-skills import: path not found: ${input.path}\n`, 1);
	}

	const stat = await ctx.fs.stat(sourcePath);
	if (!stat.isDirectory) {
		return commandError("x-skills import: expected a skill directory\n", 1);
	}

	const sourceSkillFilePath = await findSkillMarkdownFile(ctx.fs, sourcePath);
	if (!sourceSkillFilePath) {
		return commandError("x-skills import: missing SKILL.md or SKILLS.md\n", 1);
	}

	const markdown = await ctx.fs.readFile(sourceSkillFilePath);
	const { frontmatter } = parseMarkdownFrontmatter(markdown);
	const name = sanitizeSkillName(input.skillName || frontmatterName(frontmatter));
	const description = frontmatterDescription(frontmatter).trim();
	if (!name || !description) {
		return commandError(
			"x-skills import: local skills require frontmatter metadata with name and description\n",
			1,
		);
	}

	const destinationPath = ctx.fs.resolvePath(options.mountPoint, name);
	await ctx.fs.rm(destinationPath, { force: true, recursive: true });
	await ctx.fs.cp(sourcePath, destinationPath, { recursive: true });
	const skillPath = ctx.fs.resolvePath(
		destinationPath,
		sourceSkillFilePath.slice(sourcePath.length).replace(/^\/+/, ""),
	);
	const files = await collectSkillFiles(ctx.fs, destinationPath);

	if (options.lockfile) {
		await upsertSkillIndexEntry(ctx.fs, options, {
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
	const outputFiles = files.map((file) => toSkillsHomePath(ctx.fs, options.mountPoint, file));
	return {
		stdout: `${[
			"Skills imported successfully.",
			"",
			renderSkillMetadata({
				description,
				files: outputFiles,
				skillFile: outputSkillPath,
				skillsName: name,
				source: "local",
			}),
		].join("\n")}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createImportSkillCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "import",
		type: "command",
		summary: "Import a local skill directory.",
		description: [
			"Copies a local skill directory into SKILLS_HOME and indexes it. Prefer this command over writing directly into SKILLS_HOME so installed skills remain manageable.",
			"The folder must contain SKILL.md or SKILLS.md with YAML frontmatter and a markdown body.",
			"Required frontmatter fields: name, description.",
			"Expected folder structure:",
			"skill-name/",
			"  SKILL.md",
			"  scripts/      optional executable helpers",
			"  references/   optional docs loaded only when needed",
			"  assets/       optional templates, images, or other output resources",
			"Use `x-skills add --help` for the single-file SKILL.md structure.",
		],
		usage: "x-skills import <path> [skillName]",
		args: [
			{
				name: "path",
				required: true,
				summary: "Local skill directory path.",
			},
			{
				name: "skillName",
				summary: "Optional installed skill name. Defaults to frontmatter name.",
			},
		],
		examples: [{ command: "x-skills import ./my-skill" }],
		run: ({ args: { path, skillName } }, ctx) => importSkill({ path, skillName }, ctx, options),
	});
}

function sanitizeSkillName(name: string): string {
	return name.trim().replace(/[\\/]+/g, "-");
}
