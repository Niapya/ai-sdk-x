export const MAX_OUTPUT = 20_000;

const MIN_STREAM_OUTPUT = 2_000;
function formatTruncationHint(hiddenCount: number): string {
	return `... [${hiddenCount} characters were truncated, use grep|sed|head|tail|split to inspect]`;
}

export interface TruncateOutputOptions {
	maxLines?: number;
	maxOutput?: number;
}

export function truncateToolOutput(
	stdout: string,
	stderr: string,
	options: TruncateOutputOptions = {},
): { stdout: string; stderr: string } {
	const normalizedStdout = applyLineLimit(stdout, options.maxLines);
	const normalizedStderr = applyLineLimit(stderr, options.maxLines);
	const maxOutput = options.maxOutput ?? MAX_OUTPUT;

	if (normalizedStdout.length + normalizedStderr.length <= maxOutput) {
		return {
			stdout: normalizedStdout,
			stderr: normalizedStderr,
		};
	}

	if (normalizedStdout.length <= maxOutput) {
		return {
			stdout: normalizedStdout,
			stderr: truncateValue(normalizedStderr, Math.max(maxOutput - normalizedStdout.length, 0)),
		};
	}

	if (normalizedStderr.length <= maxOutput) {
		return {
			stdout: truncateValue(normalizedStdout, Math.max(maxOutput - normalizedStderr.length, 0)),
			stderr: normalizedStderr,
		};
	}

	const stderrBudget = Math.max(MIN_STREAM_OUTPUT, maxOutput - MIN_STREAM_OUTPUT);
	const stdoutBudget = Math.max(maxOutput - stderrBudget, MIN_STREAM_OUTPUT);

	return {
		stdout: truncateValue(normalizedStdout, stdoutBudget),
		stderr: truncateValue(normalizedStderr, maxOutput - stdoutBudget),
	};
}

function applyLineLimit(value: string, maxLines?: number): string {
	if (!maxLines || maxLines <= 0) {
		return value;
	}

	const lines = value.split("\n");
	if (lines.length <= maxLines) {
		return value;
	}

	const visible = lines.slice(0, maxLines).join("\n");
	const hiddenCount = value.length - visible.length;
	return `${visible}${formatTruncationHint(hiddenCount)}`;
}

function truncateValue(value: string, budget: number): string {
	if (value.length <= budget) {
		return value;
	}

	const hint = formatTruncationHint(value.length - Math.max(budget, 0));
	if (budget <= hint.length) {
		return hint.slice(0, budget);
	}

	return `${value.slice(0, budget - hint.length)}${hint}`;
}
