import { type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import {
	coreFilePath,
	getMemoryEntry,
	isMemoryCoreFileName,
	toMemoryHomePath,
	upsertMemoryEntry,
} from "@/features/memory/utils/lockfile";
import { validateDailyCategory } from "@/features/memory/utils/output";
import { commandError, defineCliCommand } from "@/utils/command";
import { resolveCliPath } from "@/utils/path";

export interface UpdateMemoryInput {
	category?: string;
	description?: string;
	file?: string;
	keywords?: string[];
	path?: string;
	stdin?: boolean;
	title: string;
}

export async function updateMemory(
	input: UpdateMemoryInput,
	ctx: CommandContext,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const title = input.title.trim();
	if (!title) {
		return commandError("x-memory update: missing <title>\n", 1);
	}
	if (input.stdin && input.file) {
		return commandError("x-memory update: use --stdin or --file, not both\n", 1);
	}

	const source = await readReplacementBody(input.file, ctx);
	if ("error" in source) {
		return source.error;
	}
	const body = source.body;

	if (isMemoryCoreFileName(title)) {
		if (body === undefined) {
			return commandError("x-memory update: core file update requires --stdin or --file\n", 1);
		}
		const path = coreFilePath(ctx.fs, options.mountPoint, title);
		await ctx.fs.mkdir(options.mountPoint, { recursive: true });
		await ctx.fs.writeFile(path, body);
		return {
			stdout: `Update memory ${title} at ${path} Successfully!\n`,
			stderr: "",
			exitCode: 0,
		};
	}

	const category = validateDailyCategory(input.category, "x-memory update");
	if ("error" in category) {
		return category.error;
	}

	const current = await getMemoryEntry(ctx.fs, options.mountPoint, category.category, title);
	if (!current) {
		return commandError(`x-memory update: memory not found: ${title}\n`, 1);
	}

	const nextPath = input.path
		? toMemoryHomePath(ctx.fs, options.mountPoint, resolveCliPath(input.path, ctx))
		: current.entry.path;
	const ref = await upsertMemoryEntry(ctx.fs, options.mountPoint, {
		...(body !== undefined ? { body } : {}),
		category: category.category,
		description: input.description?.trim() || current.entry.description,
		keywords: input.keywords ?? current.entry.keywords,
		now: options.now?.() ?? new Date(),
		path: nextPath,
		title,
	});

	return {
		stdout: `Update memory ${ref.title} in category ${ref.category} at ${ref.entry.path} Successfully!\n`,
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
		description: [
			"Updates a daily memory entry or a core memory file.",
			"Use x-memory update AGENT.md, USER.md, or MEMORY.md to update core file bodies.",
			"Use this CLI instead of writing files directly so the lockfile stays in sync.",
		],
		usage: "x-memory update <title|AGENT.md|USER.md|MEMORY.md> [--stdin|--file <path>] [flags]",
		args: [
			{
				name: "title",
				required: true,
				summary: "Daily memory title or core file name.",
			},
		],
		flags: {
			category: {
				description: "Category for the memory entry. Only daily is supported for now.",
				type: "string",
			},
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
		run: ({ args: { title }, flags: { category, description, file, keyword, path, stdin } }, ctx) =>
			updateMemory(
				{ category, description, file, keywords: keyword, path, stdin, title },
				ctx,
				options,
			),
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
