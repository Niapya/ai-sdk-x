///
/// The "x-patch" command is inspired by `patch` in OpenCode.
/// https://github.com/anomalyco/opencode/
///

import { type Command, type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import type { Hunk, PatchCommandOptions, PatchConfig, PatchOptions } from "@/features/patch/types";
import { deriveNewContentsFromChunks } from "@/features/patch/utils/apply";
import { parsePatch } from "@/features/patch/utils/parser";
import type { Feature } from "@/types";
import {
	type CliCommandDefinition,
	commandError,
	commandUsageError,
	createCommand,
	defineCliCommand,
} from "@/utils/command";
import { getCommandCwd, resolveCliPath } from "@/utils/path";

const PATCH_ARGS = [
	{
		name: "content",
		multiple: false,
		summary: "Inline patch content. Reads stdin when omitted.",
	},
] as const;

const PATCH_FLAGS = {
	file: {
		type: "string",
		helpValue: "path",
		summary: "Read the patch from a file path.",
	},
	base: {
		type: "string",
		helpValue: "path",
		summary: "Resolve relative patch paths against this base directory.",
	},
} as const;

export const PATCH_DESCRIPTION = `
"x-patch" Command is on. Use the "x-patch" Bash command to edit files.
This is the dedicated file editing command in this Bash environment. Use it for adding files, updating files, deleting files, and moving files whenever the change can be expressed as a patch.

IMPORTANT: YOU MUST USE x-patch FOR FILE MODIFICATIONS.

Your patch language is a stripped-down, file-oriented diff format designed to be easy to parse and safe to apply.

You can think of it as a high-level envelope:
x-patch <<EOF
*** Begin Patch
[ one or more file sections ]
*** End Patch
EOF

Within that envelope, you get a sequence of file operations.
You MUST include a header to specify the action you are taking.
Each operation starts with one of three headers:

*** Add File: <path> - create a new file. Every following line is a + line (the initial contents).
*** Delete File: <path> - remove an existing file. Nothing follows.
*** Update File: <path> - patch an existing file in place (optionally with a rename).

Update operations may be immediately followed by *** Move to: <new path> to rename the file.
Then provide one or more hunks. Each hunk starts with @@, optionally followed by a plain text context header such as a class or function name.

Within a hunk, each line starts with one of:
  space: context line kept unchanged
  -: old line to remove
  +: new line to add

If three lines of context are not enough to identify the code, use @@ with a nearby class, function, or method name:
@@ class BaseClass
@@ functionName
 old/new/context lines here

Full grammar:
Patch := Begin { FileOp } End
Begin := "*** Begin Patch" NEWLINE
End := "*** End Patch" NEWLINE
FileOp := AddFile | DeleteFile | UpdateFile
AddFile := "*** Add File: " path NEWLINE { "+" line NEWLINE }
DeleteFile := "*** Delete File: " path NEWLINE
UpdateFile := "*** Update File: " path NEWLINE [ MoveTo ] { Hunk }
MoveTo := "*** Move to: " newPath NEWLINE
Hunk := "@@" [ header ] NEWLINE { HunkLine } [ "*** End of File" NEWLINE ]
HunkLine := (" " | "-" | "+") text NEWLINE

A full patch can combine several operations:

x-patch <<EOF
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
EOF

It is important to remember:

- You must include a header with your intended action (Add/Delete/Update)
- You must prefix new lines with "+" even when creating a new file
- Use @@ only for optional plain text context, NEVER for unified-diff line numbers like @@ -11,6 +11,6
- Prefer relative file paths, and use --base when you need to resolve paths under a project directory`;

export function createPatchFeatureDescription(): string {
	return [
		"`x-patch` is the Bash command for modifying files with structured patches.",
		PATCH_DESCRIPTION,
		"Invocation examples: run `x-patch --help`;",
	].join("\n");
}

export const PATCH_COMMAND: CliCommandDefinition<typeof PATCH_ARGS, typeof PATCH_FLAGS> =
	defineCliCommand({
		id: "x-patch",
		type: "command",
		summary: "Apply a structured patch to files.",
		usage: "x-patch [<content>] [--file <file-path>] [--base <path>]",
		description: PATCH_DESCRIPTION,
		args: PATCH_ARGS,
		flags: PATCH_FLAGS,
		examples: [
			{
				command: `x-patch <<EOF
*** Begin Patch
*** End Patch
EOF`,
			},
			{ command: "x-patch --file change.patch" },
			{ command: "x-patch --file change.patch --base ./packages/app" },
			{ command: "cat workspace/change.patch | x-patch" },
		],
		run: () => commandError("", 0),
	});

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

export function createPatchFeature(option: boolean | PatchOptions | undefined = true): Feature {
	const config: PatchConfig = {
		enabled: option !== false,
	};

	if (!config.enabled) {
		return {
			name: "patch",
		};
	}

	const commandOptions: PatchCommandOptions = {};
	const patchCli = createPatchCommand(commandOptions);

	return {
		name: "patch",
		description: () => createPatchFeatureDescription(),
		command: [patchCli],
	};
}

export type { PatchCommandOptions, PatchConfig, PatchOptions } from "@/features/patch/types";

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
		const basePath = resolveCliPath(input.base ?? getCommandCwd(ctx), ctx);
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
				const targetPath = resolveCliPath(hunk.path, ctx, basePath);
				await ctx.fs.mkdir(parentDirectory(targetPath), { recursive: true });
				await ctx.fs.writeFile(targetPath, hunk.contents);
				operations.push(`A ${formatOperationPath(targetPath, basePath)}`);
				break;
			}

			case "delete": {
				const targetPath = resolveCliPath(hunk.path, ctx, basePath);
				if (!(await ctx.fs.exists(targetPath))) {
					throw new Error(`x-patch: cannot delete missing file: ${hunk.path}`);
				}
				await ctx.fs.rm(targetPath, { force: false, recursive: true });
				operations.push(`D ${formatOperationPath(targetPath, basePath)}`);
				break;
			}

			case "update": {
				const sourcePath = resolveCliPath(hunk.path, ctx, basePath);
				if (!(await ctx.fs.exists(sourcePath))) {
					throw new Error(`x-patch: cannot update missing file: ${hunk.path}`);
				}

				const originalContent = await ctx.fs.readFile(sourcePath);
				const next = deriveNewContentsFromChunks(hunk.path, hunk.chunks, originalContent);
				const destinationPath = hunk.movePath
					? resolveCliPath(hunk.movePath, ctx, basePath)
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
