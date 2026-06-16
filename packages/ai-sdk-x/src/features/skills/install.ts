import type { CommandContext, ExecResult } from "just-bash";
import type { SkillsCommandOptions } from "@/features/skills/types";
import {
	discoverSkills,
	relativePathFromRoot,
	sanitizeSkillName,
	selectDiscoveredSkill,
} from "@/features/skills/utils/discover";
import { cloneSkillRepository } from "@/features/skills/utils/git";
import {
	collectSkillFiles,
	toSkillsHomePath,
	upsertSkillIndexEntry,
} from "@/features/skills/utils/lockfile";
import { stringifyFrontmatter } from "@/features/skills/utils/metadata";
import { renderSkillMetadata } from "@/features/skills/utils/output";
import {
	normalizeSkillSource,
	type ParsedSkillInstallSpec,
	parseSkillInstallSpec,
} from "@/features/skills/utils/parser";
import { commandError, defineCliCommand } from "@/utils/command";
import { resolveCliPath } from "@/utils/path";

const SKILLS_API_BASE = process.env.SKILLS_API_URL || "https://skills.sh";

interface InstallSource {
	cloneRoot?: string;
	preferredPath?: string;
	repoUrl?: string;
	rootPath: string;
	sourceLabel: string;
	sourceType: "git" | "local";
}

export async function installSkill(
	spec: string,
	ctx: CommandContext,
	options: SkillsCommandOptions,
): Promise<ExecResult> {
	if (!spec) {
		return commandError("x-skills install: missing <source>[@name]\n", 1);
	}

	const parsed = parseSkillInstallSpec(spec);
	if (!parsed) {
		return commandError("x-skills install: expected <source>[@name]\n", 1);
	}

	const source = await resolveInstallSource(parsed, ctx);
	if ("error" in source) {
		return source.error;
	}

	try {
		const discoveryRoot = await resolveDiscoveryRoot(source.value, ctx);
		const skills = await discoverSkills(ctx.fs, discoveryRoot);
		const selected = selectDiscoveredSkill(skills, parsed.selector);
		if ("error" in selected) {
			return commandError(
				`x-skills install: ${selected.error} in ${source.value.sourceLabel}\n`,
				1,
			);
		}

		const installName = sanitizeSkillName(parsed.selector ?? selected.name);
		if (!installName) {
			return commandError("x-skills install: selected skill has an empty install name\n", 1);
		}

		const destinationPath = ctx.fs.resolvePath(options.mountPoint, installName);
		await ctx.fs.rm(destinationPath, { force: true, recursive: true });
		await ctx.fs.cp(selected.path, destinationPath, { recursive: true });

		const skillPath = ctx.fs.resolvePath(
			destinationPath,
			selected.skillFilePath.slice(selected.path.length).replace(/^\/+/, ""),
		);
		const files = await collectSkillFiles(ctx.fs, destinationPath);
		const sourcePath = relativePathFromRoot(ctx.fs, source.value.rootPath, selected.path);

		if (options.lockfile) {
			await upsertSkillIndexEntry(ctx.fs, options, {
				description: selected.description,
				files,
				frontmatter: stringifyFrontmatter(selected.frontmatter),
				skillPath,
				source: source.value.sourceType,
				sourcePath,
				target: {
					repoUrl: source.value.repoUrl ?? "",
					selector: installName,
					sourcePath,
				},
			});
		}

		const outputSkillPath = options.lockfile
			? toSkillsHomePath(ctx.fs, options.mountPoint, skillPath)
			: skillPath;
		const outputFiles = files.map((file) => toSkillsHomePath(ctx.fs, options.mountPoint, file));
		return {
			stdout: `${[
				"Skill installed successfully.",
				"",
				renderSkillMetadata({
					description: selected.description,
					files: outputFiles,
					skillFile: outputSkillPath,
					skillsName: installName,
					source: source.value.sourceLabel,
				}),
			].join("\n")}\n`,
			stderr: "",
			exitCode: 0,
		};
	} finally {
		if (source.value.cloneRoot) {
			await ctx.fs.rm(source.value.cloneRoot, { force: true, recursive: true });
		}
	}
}

async function resolveInstallSource(
	parsed: ParsedSkillInstallSpec,
	ctx: CommandContext,
): Promise<{ value: InstallSource } | { error: ExecResult }> {
	const wellKnown = await resolveWellKnownSource(parsed.source);
	if ("error" in wellKnown) {
		return { error: wellKnown.error };
	}

	const source = wellKnown.source;
	const localPath = resolveCliPath(source, ctx);
	if (await ctx.fs.exists(localPath)) {
		const stat = await ctx.fs.stat(localPath);
		if (!stat.isDirectory) {
			return { error: commandError(`x-skills install: expected a directory: ${source}\n`, 1) };
		}

		if (await ctx.fs.exists(ctx.fs.resolvePath(localPath, ".git"))) {
			const { clonePath, result: clone } = await cloneSkillRepository(localPath, ctx);
			if (clone.exitCode !== 0) {
				return {
					error: commandError(
						`x-skills install: failed to clone ${localPath}\n${withTrailingNewline(clone.stderr || clone.stdout || "git clone failed without output")}`,
						clone.exitCode,
					),
				};
			}

			return {
				value: {
					cloneRoot: clonePath,
					repoUrl: localPath,
					rootPath: clonePath,
					sourceLabel: source,
					sourceType: "git",
				},
			};
		}

		return {
			value: {
				rootPath: localPath,
				sourceLabel: source,
				sourceType: "local",
			},
		};
	}

	const normalized = normalizeSkillSource(source);
	const cloneUrl = normalized.cloneUrl ?? (parsed.selector ? source : undefined);
	if (!cloneUrl) {
		return {
			error: commandError(`x-skills install: path not found or unsupported source: ${source}\n`, 1),
		};
	}

	const { clonePath, result: clone } = await cloneSkillRepository(cloneUrl, ctx);
	if (clone.exitCode !== 0) {
		return {
			error: commandError(
				`x-skills install: failed to clone ${cloneUrl}\n${withTrailingNewline(clone.stderr || clone.stdout || "git clone failed without output")}`,
				clone.exitCode,
			),
		};
	}

	return {
		value: {
			cloneRoot: clonePath,
			preferredPath: normalized.preferredPath,
			repoUrl: cloneUrl,
			rootPath: clonePath,
			sourceLabel: normalized.source,
			sourceType: "git",
		},
	};
}

async function resolveDiscoveryRoot(source: InstallSource, ctx: CommandContext): Promise<string> {
	if (!source.preferredPath) {
		return source.rootPath;
	}

	const preferredRoot = ctx.fs.resolvePath(source.rootPath, source.preferredPath);
	if (await ctx.fs.exists(ctx.fs.resolvePath(preferredRoot, "SKILL.md"))) {
		return preferredRoot;
	}

	return source.rootPath;
}

async function resolveWellKnownSource(
	source: string,
): Promise<{ source: string } | { error: ExecResult }> {
	const normalized = normalizeSkillSource(source);
	if (normalized.type !== "skills-sh") {
		return { source };
	}

	try {
		const slug = new URL(source).pathname.split("/").filter(Boolean)[0];
		const response = await fetch(`${SKILLS_API_BASE}/api/skills/${encodeURIComponent(slug)}`);
		if (!response.ok) {
			return {
				error: commandError(
					`x-skills install: failed to resolve ${source}: skills.sh returned ${response.status}\n`,
					1,
				),
			};
		}

		const data = (await response.json()) as { source?: unknown };
		if (typeof data.source !== "string" || !data.source.trim()) {
			return {
				error: commandError(
					`x-skills install: failed to resolve ${source}: missing source metadata\n`,
					1,
				),
			};
		}

		return { source: data.source.trim() };
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		return {
			error: commandError(`x-skills install: failed to resolve ${source}: ${message}\n`, 1),
		};
	}
}

function withTrailingNewline(value: string): string {
	return value.endsWith("\n") ? value : `${value}\n`;
}

export function createInstallSkillCommand(
	options: SkillsCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "install",
		type: "command",
		summary: "Install a skill from a local path, repository, or skills.sh URL.",
		usage: "x-skills install <source>[@name]",
		args: [
			{
				name: "spec",
				required: true,
				summary: "Install source with an optional skill selector suffix.",
			},
		],
		examples: [
			{ command: "x-skills install intellectronica/agent-skills@context7" },
			{ command: "x-skills install ./skills/my-skill" },
			{ command: "x-skills install https://github.com/owner/repo/tree/main/.codex/skills/demo" },
		],
		run: ({ args: { spec } }, ctx) => installSkill(spec, ctx, options),
	});
}
