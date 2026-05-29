import { type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { formatDate } from "@/features/memory/utils/shared";
import { upsertMemoryEntry } from "@/features/memory/utils/store";
import { type CliCommandDefinition, defineCliCommand } from "@/utils/command";

export interface AddMemoryInput {
	keywords?: string[];
	title: string;
}

export async function addMemory(
	input: AddMemoryInput,
	ctx: CommandContext,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const { title } = input;
	const body = decodeBytesToUtf8(ctx.stdin);

	if (!body.trim()) {
		return { stdout: "", stderr: "x-memory add: stdin is empty\n", exitCode: 1 };
	}

	const date = formatDate(options.now?.() ?? new Date());
	const memoryTitle = title.trim() || "Memory";
	await upsertMemoryEntry(ctx.fs, options.mountPoint, {
		date,
		description: body.trim(),
		keywords: input.keywords ?? [],
		title: memoryTitle,
	});

	return { stdout: `${date}:${memoryTitle}\n`, stderr: "", exitCode: 0 };
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
		keyword: {
			aliases: ["keywords"];
			description: "Keyword to attach to the memory entry.";
			multiple: true;
			type: "string";
		};
	}
> {
	return defineCliCommand({
		id: "add",
		type: "command",
		summary: "Add a daily memory entry.",
		description: "Reads the memory body from stdin.",
		usage: "x-memory add [title] [flags]",
		args: [
			{
				name: "title",
				multiple: true,
				summary: "Optional title for the memory entry.",
			},
		] as const,
		flags: {
			keyword: {
				aliases: ["keywords"],
				description: "Keyword to attach to the memory entry.",
				multiple: true,
				type: "string",
			},
		} as const,
		examples: [
			{ command: "printf 'note' | x-memory add note-title" },
			{ command: "printf 'important' | x-memory add --keyword project note-title" },
		] as const,
		run: ({ args: { title = [] }, flags: { keyword = [] } }, ctx) => {
			return addMemory(
				{
					keywords: keyword,
					title: title.join(" ").trim(),
				},
				ctx,
				options,
			);
		},
	});
}
