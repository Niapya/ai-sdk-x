///
/// The "x-patch" command is inspired by `patch` in OpenCode.
/// https://github.com/anomalyco/opencode/
///

import { type Command, type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import type { PatchCommandOptions } from "@/features/patch/types";
import { deriveNewContentsFromChunks } from "@/features/patch/utils/apply";
import { PATCH_COMMAND } from "@/features/patch/utils/description";
import { parsePatch } from "@/features/patch/utils/parser";
import type { Hunk } from "@/features/patch/utils/types";
import { commandError, commandUsageError, createCommand } from "@/utils/command";

const PATCH_COMMAND_HELP = PATCH_COMMAND;

export function createPatchCommand(_options: PatchCommandOptions = {}): Command {
	return createCommand({
		...PATCH_COMMAND,
		run: ({ args: { content }, flags: { file, base } }, ctx) =>
			runPatchCommand(
				{
					content: Array.isArray(content) ? content[0] : content,
					file: normalizeOptionalString(file),
					base: normalizeOptionalString(base),
				},
				ctx,
			),
	});
}

interface PatchCommandInput {
	base?: string;
	content?: string;
	file?: string;
}

async function runPatchCommand(input: PatchCommandInput, ctx: CommandContext): Promise<ExecResult> {
	const stdin = decodeBytesToUtf8(ctx.stdin);
	const stdinProvided = stdin.trim().length > 0;
	const providedSources = [input.content, input.file, stdinProvided ? stdin : undefined].filter(
		(value) => value !== undefined,
	).length;

	if (providedSources > 1) {
		return patchUsageError(
			"x-patch: provide the patch via inline content, --file, or stdin, not multiple sources\n",
		);
	}

	if (providedSources === 0) {
		return patchUsageError("x-patch: missing inline content, --file, or stdin\n");
	}

	const patchSource = await resolvePatchText(input, stdin, ctx);
	if ("exitCode" in patchSource) {
		return patchSource;
	}

	const parsedPatch = parsePatchResult(patchSource.patchText);
	if ("exitCode" in parsedPatch) {
		return parsedPatch;
	}

	try {
		const basePath = resolveBasePath(input.base, ctx);
		const operations = await applyPatchHunks(parsedPatch.hunks, ctx, basePath);
		return {
			stdout: operations.length > 0 ? `${operations.join("\n")}\n` : "",
			stderr: "",
			exitCode: 0,
		};
	} catch (error) {
		return commandError(`${formatErrorMessage(error)}\n`, 1);
	}
}

async function resolvePatchText(
	input: PatchCommandInput,
	stdin: string,
	ctx: CommandContext,
): Promise<{ patchText: string } | ExecResult> {
	if (input.content) {
		return { patchText: input.content };
	}

	if (!input.file) {
		return { patchText: stdin };
	}

	const sourcePath = resolveCliPath(input.file, ctx);
	if (await ctx.fs.exists(sourcePath)) {
		return { patchText: await ctx.fs.readFile(sourcePath) };
	}

	return commandError(`x-patch: patch file not found: ${input.file}\n`, 1);
}

function parsePatchResult(patchText: string): { hunks: Hunk[] } | ExecResult {
	try {
		const parsed = parsePatch(patchText);
		assertHasHunks(parsed.hunks, patchText);
		return parsed;
	} catch (error) {
		return commandError(`x-patch: ${formatErrorMessage(error)}\n`, 1);
	}
}

async function applyPatchHunks(
	hunks: Hunk[],
	ctx: CommandContext,
	basePath: string,
): Promise<string[]> {
	const operations: string[] = [];

	for (const hunk of hunks) {
		switch (hunk.type) {
			case "add": {
				const targetPath = resolvePatchPath(hunk.path, basePath, ctx);
				await ctx.fs.mkdir(parentDirectory(targetPath), { recursive: true });
				await ctx.fs.writeFile(targetPath, hunk.contents);
				operations.push(`A ${formatOperationPath(targetPath, basePath)}`);
				break;
			}

			case "delete": {
				const targetPath = resolvePatchPath(hunk.path, basePath, ctx);
				if (!(await ctx.fs.exists(targetPath))) {
					throw new Error(`x-patch: cannot delete missing file: ${hunk.path}`);
				}
				await ctx.fs.rm(targetPath, { force: false, recursive: true });
				operations.push(`D ${formatOperationPath(targetPath, basePath)}`);
				break;
			}

			case "update": {
				const sourcePath = resolvePatchPath(hunk.path, basePath, ctx);
				if (!(await ctx.fs.exists(sourcePath))) {
					throw new Error(`x-patch: cannot update missing file: ${hunk.path}`);
				}

				const originalContent = await ctx.fs.readFile(sourcePath);
				const next = deriveNewContentsFromChunks(hunk.path, hunk.chunks, originalContent);
				const destinationPath = hunk.move_path
					? resolvePatchPath(hunk.move_path, basePath, ctx)
					: sourcePath;
				await ctx.fs.mkdir(parentDirectory(destinationPath), { recursive: true });
				await ctx.fs.writeFile(destinationPath, next.bom ? `\uFEFF${next.content}` : next.content);

				if (destinationPath !== sourcePath) {
					await ctx.fs.rm(sourcePath, { force: false, recursive: true });
					operations.push(
						`M ${formatOperationPath(destinationPath, basePath)} (from ${formatOperationPath(sourcePath, basePath)})`,
					);
				} else {
					operations.push(`M ${formatOperationPath(destinationPath, basePath)}`);
				}
				break;
			}
		}
	}

	return operations;
}

function patchUsageError(message: string): ExecResult {
	return commandUsageError(PATCH_COMMAND_HELP, [PATCH_COMMAND.id], message);
}

function normalizeOptionalString(
	value: string | string[] | boolean | undefined,
): string | undefined {
	if (Array.isArray(value)) {
		return value[0];
	}

	return typeof value === "string" ? value : undefined;
}

function resolveCliPath(path: string, ctx: CommandContext): string {
	return resolvePathFromBase(path, getCommandCwd(ctx), ctx);
}

function resolveBasePath(base: string | undefined, ctx: CommandContext): string {
	return resolvePathFromBase(base ?? getCommandCwd(ctx), getCommandCwd(ctx), ctx);
}

function resolvePatchPath(path: string, basePath: string, ctx: CommandContext): string {
	return resolvePathFromBase(path, basePath, ctx);
}

function getCommandCwd(ctx: CommandContext): string {
	const maybeCwd = (ctx as CommandContext & { cwd?: unknown }).cwd;
	return typeof maybeCwd === "string" ? maybeCwd : "/home/user";
}

function resolvePathFromBase(path: string, basePath: string, ctx: CommandContext): string {
	const expandedPath = expandHomePath(path, ctx);
	return ctx.fs.resolvePath(basePath, expandedPath);
}

function expandHomePath(path: string, ctx: CommandContext): string {
	if (path === "~") {
		return getHomeDirectory(ctx);
	}

	if (path.startsWith("~/")) {
		return `${getHomeDirectory(ctx)}/${path.slice(2)}`;
	}

	return path;
}

function getHomeDirectory(ctx: CommandContext): string {
	return ctx.env.get("HOME") ?? "/home/user";
}

function assertHasHunks(hunks: Hunk[], patchText: string): void {
	if (hunks.length > 0) {
		return;
	}

	const normalized = patchText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
	if (normalized === "*** Begin Patch\n*** End Patch") {
		throw new Error("patch rejected: empty patch");
	}

	throw new Error("apply_patch verification failed: no hunks found");
}

function formatOperationPath(path: string, basePath: string): string {
	if (path === basePath) {
		return ".";
	}

	if (basePath === "/") {
		return path.slice(1);
	}

	return isWithinDirectory(path, basePath) ? path.slice(`${basePath}/`.length) : path;
}

function parentDirectory(path: string): string {
	const separatorIndex = path.lastIndexOf("/");
	if (separatorIndex <= 0) {
		return "/";
	}

	return path.slice(0, separatorIndex);
}

function isWithinDirectory(path: string, root: string): boolean {
	return path === root || path.startsWith(`${root}/`);
}

function formatErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export type { PatchCommandOptions } from "@/features/patch/types";
