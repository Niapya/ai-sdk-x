///
/// The "x-patch" command is inspired by `patch` in OpenCode.
/// https://github.com/anomalyco/opencode/
///

import { type Command, type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import { deriveNewContentsFromChunks, type Hunk, parsePatch } from "@/commands/patch/patch";
import type { PatchCommandOptions } from "@/commands/patch/types";
import { commandError, commandUsageError, createCommand, defineCliCommand } from "@/utils/command";

const PATCH_ARGS = [
	{
		name: "path",
		multiple: false,
		summary: "Optional patch file path. Reads stdin when omitted.",
	},
] as const;

export const PATCH_DESCRIPTION = `Use the "x-patch" command to edit files. Your patch language is a stripped-down, file-oriented diff format designed to be easy to parse and safe to apply.

Official example: #sym:patch

You can think of it as a high-level envelope:

*** Begin Patch
[ one or more file sections ]
*** End Patch

Within that envelope, you get a sequence of file operations.
You MUST include a header to specify the action you are taking.
Each operation starts with one of three headers:

*** Add File: <path> - create a new file. Every following line is a + line (the initial contents).
*** Delete File: <path> - remove an existing file. Nothing follows.
*** Update File: <path> - patch an existing file in place (optionally with a rename).

Example patch:
*** Begin Patch
*** Add File: hello.txt
+Hello world
*** Update File: src/app.py
*** Move to: src/main.py
@@ def greet():
-print("Hi")
+print("Hello, world!")
*** Delete File: obsolete.txt
*** End Patch

It is important to remember:

- You must include a header with your intended action (Add/Delete/Update)
- You must prefix new lines with "+" even when creating a new file`;

export const PATCH_DESCRIPTION_LINES = PATCH_DESCRIPTION.split("\n");

const PATCH_COMMAND = defineCliCommand({
	id: "x-patch",
	type: "command",
	summary: "Apply a structured patch to the mounted workspace.",
	usage: "x-patch [path]",
	description: ["#sym:PATCH_DESCRIPTION", ...PATCH_DESCRIPTION_LINES],
	args: PATCH_ARGS,
	examples: [
		{ command: "x-patch workspace/change.patch" },
		{ command: "cat workspace/change.patch | x-patch" },
	],
	run: () => commandError("", 0),
});

const PATCH_COMMAND_HELP = {
	...PATCH_COMMAND,
	flags: {},
};

export function createPatchCommand(options: PatchCommandOptions): Command {
	return createCommand({
		...PATCH_COMMAND,
		run: ({ args: { path } }, ctx) =>
			runPatchCommand(Array.isArray(path) ? path[0] : path, ctx, options),
	});
}

async function runPatchCommand(
	path: string | undefined,
	ctx: CommandContext,
	options: PatchCommandOptions,
): Promise<ExecResult> {
	const stdin = decodeBytesToUtf8(ctx.stdin);
	const stdinProvided = stdin.trim().length > 0;

	if (path && stdinProvided) {
		return patchUsageError("x-patch: provide the patch via [path] or stdin, not both\n");
	}

	if (!path && !stdinProvided) {
		return patchUsageError("x-patch: missing [path] or stdin\n");
	}

	const patchSource = await resolvePatchText(path, stdin, ctx);
	if ("exitCode" in patchSource) {
		return patchSource;
	}

	const parsedPatch = parsePatchResult(patchSource.patchText);
	if ("exitCode" in parsedPatch) {
		return parsedPatch;
	}

	try {
		await ctx.fs.mkdir(options.mountPoint, { recursive: true });
		const operations = await applyPatchHunks(parsedPatch.hunks, ctx, options);
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
	path: string | undefined,
	stdin: string,
	ctx: CommandContext,
): Promise<{ patchText: string } | ExecResult> {
	if (!path) {
		return { patchText: stdin };
	}

	const sourcePath = resolveInputPath(path, ctx);
	if (await ctx.fs.exists(sourcePath)) {
		return { patchText: await ctx.fs.readFile(sourcePath) };
	}

	if (looksLikePatchText(path)) {
		return { patchText: path };
	}

	return commandError(`x-patch: patch file not found: ${path}\n`, 1);
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
	options: PatchCommandOptions,
): Promise<string[]> {
	const operations: string[] = [];

	for (const hunk of hunks) {
		switch (hunk.type) {
			case "add": {
				const targetPath = resolveWorkspacePath(ctx, options.mountPoint, hunk.path);
				await ctx.fs.mkdir(parentDirectory(targetPath), { recursive: true });
				await ctx.fs.writeFile(targetPath, hunk.contents);
				operations.push(`A ${workspaceRelativePath(targetPath, options.mountPoint)}`);
				break;
			}

			case "delete": {
				const targetPath = resolveWorkspacePath(ctx, options.mountPoint, hunk.path);
				if (!(await ctx.fs.exists(targetPath))) {
					throw new Error(`x-patch: cannot delete missing file: ${hunk.path}`);
				}
				await ctx.fs.rm(targetPath, { force: false, recursive: true });
				operations.push(`D ${workspaceRelativePath(targetPath, options.mountPoint)}`);
				break;
			}

			case "update": {
				const sourcePath = resolveWorkspacePath(ctx, options.mountPoint, hunk.path);
				if (!(await ctx.fs.exists(sourcePath))) {
					throw new Error(`x-patch: cannot update missing file: ${hunk.path}`);
				}

				const originalContent = await ctx.fs.readFile(sourcePath);
				const next = deriveNewContentsFromChunks(hunk.path, hunk.chunks, originalContent);
				const destinationPath = hunk.move_path
					? resolveWorkspacePath(ctx, options.mountPoint, hunk.move_path)
					: sourcePath;
				await ctx.fs.mkdir(parentDirectory(destinationPath), { recursive: true });
				await ctx.fs.writeFile(destinationPath, next.bom ? `\uFEFF${next.content}` : next.content);

				if (destinationPath !== sourcePath) {
					await ctx.fs.rm(sourcePath, { force: false, recursive: true });
					operations.push(
						`M ${workspaceRelativePath(destinationPath, options.mountPoint)} (from ${workspaceRelativePath(sourcePath, options.mountPoint)})`,
					);
				} else {
					operations.push(`M ${workspaceRelativePath(destinationPath, options.mountPoint)}`);
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

function resolveInputPath(path: string, ctx: CommandContext): string {
	return ctx.fs.resolvePath(getCommandCwd(ctx), path);
}

function resolveWorkspacePath(ctx: CommandContext, mountPoint: string, path: string): string {
	const resolvedPath = ctx.fs.resolvePath(mountPoint, path);
	if (!isWithinDirectory(resolvedPath, mountPoint)) {
		throw new Error(`x-patch: patch path escapes the workspace mount: ${path}`);
	}
	return resolvedPath;
}

function getCommandCwd(ctx: CommandContext): string {
	const maybeCwd = (ctx as CommandContext & { cwd?: unknown }).cwd;
	return typeof maybeCwd === "string" ? maybeCwd : "/home/user";
}

function looksLikePatchText(value: string): boolean {
	return value.trimStart().startsWith("*** Begin Patch");
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

function workspaceRelativePath(path: string, mountPoint: string): string {
	if (path === mountPoint) {
		return ".";
	}

	return path.slice(`${mountPoint}/`.length);
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

export type { PatchCommandOptions } from "@/commands/patch/types";
