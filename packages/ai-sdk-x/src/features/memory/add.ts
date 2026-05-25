import { type CommandContext, decodeBytesToUtf8, type ExecResult } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import { formatDate } from "@/features/memory/utils/shared";
import { type CliCommandDefinition, defineCliCommand } from "@/utils/command";

export interface AddMemoryInput {
	longTerm: boolean;
	title: string;
}

export async function addMemory(
	input: AddMemoryInput,
	ctx: CommandContext,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const { longTerm, title } = input;
	const body = decodeBytesToUtf8(ctx.stdin);

	if (!body.trim()) {
		return { stdout: "", stderr: "x-memory add: stdin is empty\n", exitCode: 1 };
	}

	await ctx.fs.mkdir(options.mountPoint, { recursive: true });

	if (longTerm) {
		const memoryPath = ctx.fs.resolvePath(options.mountPoint, "MEMORY.md");
		const heading = title || "Memory";
		const entry = `\n## ${heading}\n\n${body.trim()}\n`;
		if (await ctx.fs.exists(memoryPath)) {
			await ctx.fs.appendFile(memoryPath, entry);
		} else {
			await ctx.fs.writeFile(memoryPath, `# Memory\n${entry}`);
		}
		await options.cache?.delete("memory:list");
		return { stdout: `${memoryPath}\n`, stderr: "", exitCode: 0 };
	}

	const date = formatDate(options.now?.() ?? new Date());
	const dailyDir = ctx.fs.resolvePath(options.mountPoint, `daily/${date}`);
	await ctx.fs.mkdir(dailyDir, { recursive: true });

	const memoryPath = ctx.fs.resolvePath(dailyDir, `${slugifyMemoryTitle(title || "memory")}.md`);
	await ctx.fs.writeFile(memoryPath, `# ${title || "Memory"}\n\n${body.trim()}\n`);
	await options.cache?.delete("memory:list");
	return { stdout: `${memoryPath}\n`, stderr: "", exitCode: 0 };
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
		"long-term": {
			allowNo: true;
			description: "Write the memory entry into MEMORY.md.";
			type: "boolean";
		};
	}
> {
	return defineCliCommand({
		id: "add",
		type: "command",
		summary: "Add a daily or long-term memory entry.",
		description: "Reads the memory body from stdin.",
		usage: "x-memory add [title] [flags]",
		args: [
			{
				name: "title",
				multiple: true,
				summary: "Optional title for the memory entry.",
			},
		],
		flags: {
			"long-term": {
				allowNo: true,
				description: "Write the memory entry into MEMORY.md.",
				type: "boolean",
			},
		},
		examples: [
			{ command: "printf 'note' | x-memory add note-title" },
			{ command: "printf 'important' | x-memory add --long-term note-title" },
		],
		run: ({ args: { title = [] }, flags: { "long-term": longTerm = false } }, ctx) => {
			return addMemory(
				{
					longTerm,
					title: title.join(" ").trim(),
				},
				ctx,
				options,
			);
		},
	});
}

function slugifyMemoryTitle(title: string): string {
	const slug = title
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return slug || "memory";
}
