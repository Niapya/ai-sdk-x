export function normalizeNewlines(value: string): string {
	return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function stripHeredoc(input: string): string {
	const heredocMatch = input.match(/^(?:(?:\S+\s+)*?)?<<['"]?(\w+)['"]?\s*\n([\s\S]*?)\n\1\s*$/);
	return heredocMatch ? heredocMatch[2] : input;
}

export function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
