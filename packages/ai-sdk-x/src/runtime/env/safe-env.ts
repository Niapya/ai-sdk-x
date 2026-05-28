const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Create an env record that cannot inherit or mutate Object prototype fields.
 */
export function createNullProtoEnv(): Record<string, string> {
	return Object.create(null) as Record<string, string>;
}

/**
 * Copy string-valued env entries while dropping prototype-pollution keys.
 */
export function cloneEnv(input: Record<string, unknown> | undefined): Record<string, string> {
	const out = createNullProtoEnv();
	if (!input) return out;

	for (const key of Object.keys(input)) {
		if (BLOCKED_KEYS.has(key)) continue;
		const value = input[key];
		if (typeof value !== "string") continue;
		out[key] = value;
	}

	return out;
}

/**
 * Merge env records into a null-prototype record, with later inputs winning.
 */
export function mergeEnv(
	...inputs: Array<Record<string, unknown> | undefined>
): Record<string, string> {
	const out = createNullProtoEnv();

	for (const input of inputs) {
		if (!input) continue;
		for (const key of Object.keys(input)) {
			if (BLOCKED_KEYS.has(key)) continue;
			const value = input[key];
			if (typeof value !== "string") continue;
			out[key] = value;
		}
	}

	return out;
}
