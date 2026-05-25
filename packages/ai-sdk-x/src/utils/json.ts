export type JsonPrimitive = boolean | null | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = Record<string, JsonValue>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") return false;

	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

export function isJsonValue(value: unknown): value is JsonValue {
	if (value === null) return true;

	const t = typeof value;
	if (t === "string" || t === "boolean") return true;
	if (t === "number") return Number.isFinite(value);

	if (Array.isArray(value)) {
		if (value.length !== Object.keys(value).length) return false;
		return value.every(isJsonValue);
	}

	if (!isPlainObject(value)) return false;

	return Object.values(value).every(isJsonValue);
}

export function isJsonRecord(value: unknown): value is JsonRecord {
	return isPlainObject(value) && Object.values(value).every(isJsonValue);
}
