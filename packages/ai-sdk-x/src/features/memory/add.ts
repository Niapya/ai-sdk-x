import { type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { toMemoryHomePath, upsertMemoryEntry } from "@/features/memory/utils/lockfile";
import { validateDailyCategory } from "@/features/memory/utils/output";
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
	const memoryTitle = input.title.trim();
	if (!memoryTitle) {
		return commandError("x-memory add: missing <title>\n", 1);
	}
	if (!input.description?.trim()) {
		return commandError("x-memory add: missing --description\n", 1);
	}
	if (!input.keywords || input.keywords.length === 0) {
		return commandError("x-memory add: missing --keyword\n", 1);
	}
	const category = validateDailyCategory(input.category, "x-memory add");
	if ("error" in category) {
		return category.error;
	}
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

	const ref = await upsertMemoryEntry(ctx.fs, options.mountPoint, {
		body,
		category: category.category,
		description: input.description.trim(),
		keywords: input.keywords ?? [],
		now: options.now?.() ?? new Date(),
		path: input.path
			? toMemoryHomePath(ctx.fs, options.mountPoint, resolveCliPath(input.path, ctx))
			: undefined,
		title: memoryTitle,
	});

	return {
		stdout: `Add memory ${ref.title} to category ${ref.category} at ${ref.entry.path} Successfully!\n`,
		stderr: "",
		exitCode: 0,
	};
}

export function createAddMemoryCommand(options: MemoryCommandOptions): CliCommandDefinition<
	readonly [
		{
			name: "title";
			multiple: true;
			summary: "Title/name for the daily memory entry.";
		},
	],
	{
		category: {
			description: "Category for the memory entry. Only daily is supported for now.";
			type: "string";
		};
		description: {
			description: "Required searchable description for metadata-only find.";
			type: "string";
		};
		file: {
			description: "Read the memory body from a file path.";
			type: "string";
		};
		keyword: {
			aliases: ["keywords"];
			description: "Required keyword to attach to the memory entry. Repeat for multiple keywords.";
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
		description: [
			"Adds a daily memory body plus searchable metadata to memory.json.",
			"Required metadata: title, --description, and at least one --keyword.",
			"Use this CLI instead of writing files directly so the lockfile stays in sync.",
		],
		usage: "x-memory add <title> --description <text> --keyword <kw> [--stdin|--file <path>]",
		args: [
			{
				name: "title",
				multiple: true,
				summary: "Title/name for the daily memory entry.",
			},
		] as const,
		flags: {
			category: {
				description: "Category for the memory entry. Only daily is supported for now.",
				type: "string",
			},
			description: {
				description: "Required searchable description for metadata-only find.",
				type: "string",
			},
			file: {
				description: "Read the memory body from a file path.",
				type: "string",
			},
			keyword: {
				aliases: ["keywords"],
				description:
					"Required keyword to attach to the memory entry. Repeat for multiple keywords.",
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
			{
				command:
					"printf 'note' | x-memory add note-title --description 'Short summary' --keyword project --stdin",
			},
			{
				command:
					"x-memory add note-title --description 'Short summary' --keyword project --file ./notes/project.md",
			},
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
