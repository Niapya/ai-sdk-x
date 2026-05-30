import { type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import {
	formatMemoryRef,
	toMemoryHomePath,
	upsertMemoryEntry,
} from "@/features/memory/utils/lockfile";
import { type CliCommandDefinition, commandError, defineCliCommand } from "@/utils/command";
import { resolveCliPath } from "@/utils/path";

export interface AddMemoryInput {
	category?: string;
	description?: string;
	file?: string;
	keywords?: string[];
	path?: string;
	stdin?: boolean;
	title: string;
}

export async function addMemory(
	input: AddMemoryInput,
	ctx: CommandContext,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	if (input.stdin && input.file) {
		return commandError("x-memory add: use --stdin or --file, not both\n", 1);
	}

	const source = await readMemoryBody(input.file, ctx);
	if ("error" in source) {
		return source.error;
	}
	const body = source.body;

	if (!body.trim()) {
		return { stdout: "", stderr: "x-memory add: memory body is empty\n", exitCode: 1 };
	}

	const memoryTitle = input.title.trim() || "Memory";
	const ref = await upsertMemoryEntry(ctx.fs, options.mountPoint, {
		body,
		category: input.category ?? "daily",
		description: input.description?.trim() || summarizeMemoryBody(body),
		keywords: input.keywords ?? [],
		now: options.now?.() ?? new Date(),
		path: input.path
			? toMemoryHomePath(ctx.fs, options.mountPoint, resolveCliPath(input.path, ctx))
			: undefined,
		title: memoryTitle,
	});

	return {
		stdout: `${[
			`added\t${formatMemoryRef(ref.category, ref.title)}`,
			`title\t${ref.title}`,
			`category\t${ref.category}`,
			`description\t${ref.entry.description}`,
			`keywords\t${ref.entry.keywords.join(",")}`,
			`path\t${ref.entry.path}`,
		].join("\n")}\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createAddMemoryCommand(options: MemoryCommandOptions): CliCommandDefinition<
	readonly [
		{
			name: "title";
			multiple: true;
			summary: "Optional title for the memory entry.";
		},
	],
	{
		category: {
			description: "Category for the memory entry, such as daily, project, or topic.";
			type: "string";
		};
		description: {
			description: "Short searchable description. Defaults to the first body line.";
			type: "string";
		};
		file: {
			description: "Read the memory body from a file path.";
			type: "string";
		};
		keyword: {
			aliases: ["keywords"];
			description: "Keyword to attach to the memory entry.";
			multiple: true;
			type: "string";
		};
		path: {
			description: "Destination path for the stored memory body.";
			type: "string";
		};
		stdin: {
			description: "Read the memory body from stdin.";
			type: "boolean";
		};
	}
> {
	return defineCliCommand({
		id: "add",
		type: "command",
		summary: "Add a categorized memory entry.",
		description: "Reads the memory body from --file when provided, otherwise from stdin.",
		usage: "x-memory add [title] [--stdin|--file <path>] [flags]",
		args: [
			{
				name: "title",
				multiple: true,
				summary: "Optional title for the memory entry.",
			},
		] as const,
		flags: {
			category: {
				description: "Category for the memory entry, such as daily, project, or topic.",
				type: "string",
			},
			description: {
				description: "Short searchable description. Defaults to the first body line.",
				type: "string",
			},
			file: {
				description: "Read the memory body from a file path.",
				type: "string",
			},
			keyword: {
				aliases: ["keywords"],
				description: "Keyword to attach to the memory entry.",
				multiple: true,
				type: "string",
			},
			path: {
				description: "Destination path for the stored memory body.",
				type: "string",
			},
			stdin: {
				description: "Read the memory body from stdin.",
				type: "boolean",
			},
		} as const,
		examples: [
			{ command: "printf 'note' | x-memory add --category daily --stdin note-title" },
			{ command: "x-memory add --category project --file ./notes/project.md project-note" },
			{ command: "printf 'important' | x-memory add --keyword project note-title" },
		] as const,
		run: (
			{ args: { title = [] }, flags: { category, description, file, keyword = [], path, stdin } },
			ctx,
		) =>
			addMemory(
				{
					category,
					description,
					file,
					keywords: keyword,
					path,
					stdin,
					title: title.join(" ").trim(),
				},
				ctx,
				options,
			),
	});
}

async function readMemoryBody(
	file: string | undefined,
	ctx: CommandContext,
): Promise<{ body: string } | { error: ExecResult }> {
	if (!file) {
		return { body: decodeBytesToUtf8(ctx.stdin) };
	}

	const path = resolveCliPath(file, ctx);
	if (!(await ctx.fs.exists(path))) {
		return { error: commandError(`x-memory add: file not found: ${file}\n`, 1) };
	}

	return { body: await ctx.fs.readFile(path) };
}

export function summarizeMemoryBody(body: string): string {
	const firstLine = body
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
	if (!firstLine) {
		return "";
	}

	return firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
}
