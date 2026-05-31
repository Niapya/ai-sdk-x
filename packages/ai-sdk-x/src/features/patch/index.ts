///
/// The "x-patch" command is inspired by `apply_patch` in Codex and OpenCode.
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
		multiple: true,
		summary: "Inline patch content. Reads stdin when omitted.",
	},
] as const;

export const PATCH_DESCRIPTION = `
"x-patch" Command is on. Use the "x-patch" Bash command to edit files.
This is the dedicated file editing command in this Bash environment. Use it for adding files, updating files, deleting files, and moving files whenever the change can be expressed as a patch.

IMPORTANT: YOU MUST USE x-patch FOR FILE MODIFICATIONS.

The command shape is:
x-patch [content...]

When content is omitted, x-patch reads stdin. Bash heredocs and pipes work naturally:

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

x-patch "*** Begin Patch
*** Update File: README.md
@@
-old
+new
*** End Patch"

Your patch language is a stripped-down, file-oriented diff format designed to be easy to parse and safe to apply.

Each patch has a high-level envelope:
*** Begin Patch
[ one or more file sections ]
*** End Patch

Within that envelope, the parser recognizes four headers/directives:

*** Add File: <path> - create a new file. Every following line is a + line.
*** Delete File: <path> - remove an existing file. Nothing follows.
*** Update File: <path> - patch an existing file in place.
*** Move to: <new path> - rename the preceding Update File target while applying that update.

Update hunks usually start with @@, optionally followed by plain text context such as a class or function name.
The parser accepts light indentation around markers and hunks, but marker names and file operation headers should remain recognizable.

Within a hunk, each line starts with one of:
space: context line kept unchanged
-: old line to remove
+: new line to add

It is important to remember:

- You must include a header with your intended action (Add/Delete/Update)
- You must prefix new lines with "+" even when creating a file
- Prefer heredoc input for multi-file patches
- Paths are resolved relative to the current command cwd`;

export function createPatchFeatureDescription(): string {
	return [
		"`x-patch` is the Bash command for modifying files with structured patches.",
		PATCH_DESCRIPTION,
		"Invocation examples: run `x-patch --help`;",
	].join("\n");
}

const PATCH_FLAGS = {} as const;

export const PATCH_COMMAND: CliCommandDefinition<typeof PATCH_ARGS, typeof PATCH_FLAGS> =
	defineCliCommand({
		id: "x-patch",
		type: "command",
		summary: "Apply a structured patch to files.",
		usage: "x-patch [content...]",
		description: PATCH_DESCRIPTION,
		allowDashPositionals: true,
		args: PATCH_ARGS,
		flags: PATCH_FLAGS,
		examples: [
			{
				command: `x-patch <<EOF
*** Begin Patch
*** Add File: hello.txt
+hello
*** End Patch
EOF`,
			},
			{
				command: `x-patch "*** Begin Patch
*** Update File: README.md
@@
-old
+new
*** End Patch"`,
			},
		],
		run: () => commandError("", 0),
	});

const PATCH_COMMAND_HELP = PATCH_COMMAND;

export function createPatchCommand(_options: PatchCommandOptions = {}): Command {
	return createCommand({
		...PATCH_COMMAND,
		run: ({ args: { content } }, ctx) =>
			runPatchCommand(
				{
					content,
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
	content?: string | string[];
}

async function runPatchCommand(input: PatchCommandInput, ctx: CommandContext): Promise<ExecResult> {
	const stdin = decodeBytesToUtf8(ctx.stdin);
	const stdinProvided = stdin.trim().length > 0;
	const content = normalizeContent(input.content);
	const contentProvided = content !== undefined && content.trim().length > 0;

	if (contentProvided && stdinProvided) {
		return patchUsageError(
			"x-patch: provide patch content either as arguments or stdin, not both.\n",
		);
	}

	if (!contentProvided && !stdinProvided) {
		return patchUsageError(
			`x-patch: missing patch content. Use a heredoc, for example:
x-patch <<EOF
*** Begin Patch
*** Add File: hello.txt
+hello
*** End Patch
EOF
`,
		);
	}

	const patchText = contentProvided ? content : stdin;
	const parsedPatch = parsePatchResult(patchText ?? "");
	if ("exitCode" in parsedPatch) {
		return parsedPatch;
	}

	try {
		const basePath = resolveCliPath(getCommandCwd(ctx), ctx);
		const operations = await applyPatchHunks(parsedPatch.hunks, ctx, basePath);
		return {
			stdout: `Success. Updated the following files:\n${operations.join("\n")}\n`,
			stderr: "",
			exitCode: 0,
		};
	} catch (error) {
		return commandError(`x-patch: ${formatErrorMessage(error)}\n`, 1);
	}
}

function normalizeContent(content: string | string[] | undefined): string | undefined {
	if (!content || content.length === 0) {
		return undefined;
	}

	if (typeof content === "string") {
		return content;
	}

	return content.length === 1 ? content[0] : content.join("\n");
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
	const plans = await planPatchHunks(hunks, ctx, basePath);

	for (const plan of plans) {
		switch (plan.type) {
			case "add":
				await ctx.fs.mkdir(parentDirectory(plan.targetPath), { recursive: true });
				await ctx.fs.writeFile(plan.targetPath, plan.content);
				break;

			case "delete":
				await ctx.fs.rm(plan.targetPath, { force: false, recursive: false });
				break;

			case "update":
				await ctx.fs.mkdir(parentDirectory(plan.destinationPath), { recursive: true });
				await ctx.fs.writeFile(plan.destinationPath, plan.content);
				if (plan.shouldRemoveSource) {
					await ctx.fs.rm(plan.sourcePath, { force: false, recursive: false });
				}
				break;
		}
	}

	return plans.map((plan) => plan.operation);
}

type PlannedPatchOperation =
	| { content: string; operation: string; targetPath: string; type: "add" }
	| { operation: string; targetPath: string; type: "delete" }
	| {
			content: string;
			destinationPath: string;
			operation: string;
			shouldRemoveSource: boolean;
			sourcePath: string;
			type: "update";
	  };

async function planPatchHunks(
	hunks: Hunk[],
	ctx: CommandContext,
	basePath: string,
): Promise<PlannedPatchOperation[]> {
	const plans: PlannedPatchOperation[] = [];

	for (const hunk of hunks) {
		switch (hunk.type) {
			case "add": {
				const targetPath = resolveCliPath(hunk.path, ctx, basePath);
				const content =
					hunk.contents.length === 0 || hunk.contents.endsWith("\n")
						? hunk.contents
						: `${hunk.contents}\n`;
				plans.push({
					type: "add",
					targetPath,
					content,
					operation: `A ${formatOperationPath(targetPath, basePath)}`,
				});
				break;
			}

			case "delete": {
				const targetPath = resolveCliPath(hunk.path, ctx, basePath);
				if (!(await ctx.fs.exists(targetPath))) {
					throw new Error(`cannot delete missing file: ${hunk.path}`);
				}
				const stat = await ctx.fs.stat(targetPath);
				if (stat.isDirectory) {
					throw new Error(`cannot delete directory with x-patch: ${hunk.path}`);
				}
				plans.push({
					type: "delete",
					targetPath,
					operation: `D ${formatOperationPath(targetPath, basePath)}`,
				});
				break;
			}

			case "update": {
				const sourcePath = resolveCliPath(hunk.path, ctx, basePath);
				if (!(await ctx.fs.exists(sourcePath))) {
					throw new Error(`cannot update missing file: ${hunk.path}`);
				}

				const originalContent = await ctx.fs.readFile(sourcePath);
				const next = deriveNewContentsFromChunks(hunk.path, hunk.chunks, originalContent);
				const destinationPath = hunk.movePath
					? resolveCliPath(hunk.movePath, ctx, basePath)
					: sourcePath;

				plans.push({
					type: "update",
					sourcePath,
					destinationPath,
					content: next.bom ? `\uFEFF${next.content}` : next.content,
					shouldRemoveSource:
						destinationPath !== sourcePath && resolveCliPath(destinationPath, ctx) !== sourcePath,
					operation: `M ${formatOperationPath(destinationPath, basePath)}`,
				});
				break;
			}
		}
	}

	return plans;
}

function patchUsageError(message: string): ExecResult {
	return commandUsageError(PATCH_COMMAND_HELP, [PATCH_COMMAND.id], message);
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
