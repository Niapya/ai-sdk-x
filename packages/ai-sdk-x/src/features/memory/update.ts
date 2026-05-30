import { type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import { summarizeMemoryBody } from "@/features/memory/add";
import type { MemoryCommandOptions } from "@/features/memory/types";
import {
	formatMemoryRef,
	getMemoryEntry,
	parseMemoryRef,
	toMemoryHomePath,
	upsertMemoryEntry,
} from "@/features/memory/utils/lockfile";
import { commandError, defineCliCommand } from "@/utils/command";
import { resolveCliPath } from "@/utils/path";

export interface UpdateMemoryInput {
	description?: string;
	file?: string;
	keywords?: string[];
	path?: string;
	ref: string;
	stdin?: boolean;
}

export async function updateMemory(
	input: UpdateMemoryInput,
	ctx: CommandContext,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const parsed = parseMemoryRef(input.ref);
	if (!parsed) {
		return commandError("x-memory update: expected <category:title>\n", 1);
	}

	const current = await getMemoryEntry(ctx.fs, options.mountPoint, parsed.category, parsed.title);
	if (!current) {
		return commandError(`x-memory update: memory not found: ${input.ref}\n`, 1);
	}
	if (input.stdin && input.file) {
		return commandError("x-memory update: use --stdin or --file, not both\n", 1);
	}

	const source = await readReplacementBody(input.file, ctx);
	if ("error" in source) {
		return source.error;
	}
	const body = source.body;
	const nextPath = input.path
		? toMemoryHomePath(ctx.fs, options.mountPoint, resolveCliPath(input.path, ctx))
		: current.entry.path;
	const ref = await upsertMemoryEntry(ctx.fs, options.mountPoint, {
		...(body !== undefined ? { body } : {}),
		category: parsed.category,
		description:
			input.description?.trim() ||
			(body?.trim() ? summarizeMemoryBody(body) : current.entry.description),
		keywords: input.keywords ?? current.entry.keywords,
		now: options.now?.() ?? new Date(),
		path: nextPath,
		title: parsed.title,
	});

	return {
		stdout: `${[
			`updated\t${formatMemoryRef(ref.category, ref.title)}`,
			`description\t${ref.entry.description}`,
			`keywords\t${ref.entry.keywords.join(",")}`,
			`path\t${ref.entry.path}`,
		].join("\n")}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createUpdateMemoryCommand(
	options: MemoryCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "update",
		type: "command",
		summary: "Update a memory entry.",
		description: "Reads the replacement body from --file when provided, otherwise from stdin.",
		usage: "x-memory update <category:title> [--stdin|--file <path>] [flags]",
		args: [
			{
				name: "ref",
				required: true,
				summary: "Memory reference formatted as category:title.",
			},
		],
		flags: {
			description: {
				description: "Replacement searchable description.",
				type: "string",
			},
			file: {
				description: "Read the replacement body from a file path.",
				type: "string",
			},
			keyword: {
				aliases: ["keywords"],
				description: "Replacement keyword for the memory entry.",
				multiple: true,
				type: "string",
			},
			path: {
				description: "Replacement destination path for the stored memory body.",
				type: "string",
			},
			stdin: {
				description: "Read the replacement body from stdin.",
				type: "boolean",
			},
		},
		run: ({ args: { ref }, flags: { description, file, keyword, path, stdin } }, ctx) =>
			updateMemory({ description, file, keywords: keyword, path, ref, stdin }, ctx, options),
	});
}

async function readReplacementBody(
	file: string | undefined,
	ctx: CommandContext,
): Promise<{ body: string | undefined } | { error: ExecResult }> {
	if (file) {
		const path = resolveCliPath(file, ctx);
		if (!(await ctx.fs.exists(path))) {
			return { error: commandError(`x-memory update: file not found: ${file}\n`, 1) };
		}
		return { body: await ctx.fs.readFile(path) };
	}

	const stdin = decodeBytesToUtf8(ctx.stdin);
	return { body: stdin.trim() ? stdin : undefined };
}
