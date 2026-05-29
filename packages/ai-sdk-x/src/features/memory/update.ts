import { type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { getMemoryEntry, parseMemoryRef, upsertMemoryEntry } from "@/features/memory/utils/store";
import { commandError, defineCliCommand } from "@/utils/command";

export interface UpdateMemoryInput {
	keywords?: string[];
	ref: string;
}

export async function updateMemory(
	input: UpdateMemoryInput,
	ctx: CommandContext,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const parsed = parseMemoryRef(input.ref);
	if (!parsed) {
		return commandError("x-memory update: expected <date:title>\n", 1);
	}

	const current = await getMemoryEntry(ctx.fs, options.mountPoint, parsed.date, parsed.title);
	if (!current) {
		return commandError(`x-memory update: memory not found: ${input.ref}\n`, 1);
	}

	const body = decodeBytesToUtf8(ctx.stdin).trim();
	await upsertMemoryEntry(ctx.fs, options.mountPoint, {
		date: parsed.date,
		description: body || current.entry.description,
		keywords: input.keywords ?? current.entry.keywords,
		title: parsed.title,
	});

	return { stdout: `${parsed.date}:${parsed.title}\n`, stderr: "", exitCode: 0 };
}

export function createUpdateMemoryCommand(
	options: MemoryCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "update",
		type: "command",
		summary: "Update a memory entry.",
		description: "Reads the replacement description from stdin when provided.",
		usage: "x-memory update <date:title> [flags]",
		args: [
			{
				name: "ref",
				required: true,
				summary: "Memory reference formatted as YYYY-MM-DD:title.",
			},
		],
		flags: {
			keyword: {
				aliases: ["keywords"],
				description: "Replacement keyword for the memory entry.",
				multiple: true,
				type: "string",
			},
		},
		run: ({ args: { ref }, flags: { keyword } }, ctx) =>
			updateMemory({ keywords: keyword, ref }, ctx, options),
	});
}
