import type { ExecResult, IFileSystem } from "just-bash";
import type { MemoryCommandOptions } from "@/features/memory/types";
import {
	formatMemoryRef,
	getMemoryEntry,
	parseMemoryRef,
	resolveMemoryHomePath,
} from "@/features/memory/utils/lockfile";
import { commandError, defineCliCommand } from "@/utils/command";

export async function getMemory(
	ref: string,
	fs: IFileSystem,
	options: MemoryCommandOptions,
): Promise<ExecResult> {
	const parsed = parseMemoryRef(ref);
	if (!parsed) {
		return commandError("x-memory get: expected <category:title>\n", 1);
	}

	const found = await getMemoryEntry(fs, options.mountPoint, parsed.category, parsed.title);
	if (!found) {
		return commandError(`x-memory get: memory not found: ${ref}\n`, 1);
	}

	const path = resolveMemoryHomePath(fs, options.mountPoint, found.entry.path);
	const body = (await fs.exists(path)) ? await fs.readFile(path) : "";

	return {
		stdout:
			[
				`ref\t${formatMemoryRef(found.category, found.title)}`,
				`title\t${found.title}`,
				`category\t${found.category}`,
				`description\t${found.entry.description}`,
				`keywords\t${found.entry.keywords.join(",")}`,
				`path\t${found.entry.path}`,
				"",
				body,
			].join("\n") + (body.endsWith("\n") ? "" : "\n"),
		stderr: "",
		exitCode: 0,
	};
}

export function createGetMemoryCommand(
	options: MemoryCommandOptions,
): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "get",
		type: "command",
		summary: "Show a memory entry.",
		usage: "x-memory get <category:title>",
		args: [
			{
				name: "ref",
				required: true,
				summary: "Memory reference formatted as category:title.",
			},
		],
		run: ({ args: { ref } }, ctx) => getMemory(ref, ctx.fs, options),
	});
}
