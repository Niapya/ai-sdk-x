import { describe, expect, it } from "bun:test";
import { isJsonRecord, isJsonValue } from "@/utils/json";

describe("isJsonValue", () => {
	it("accepts null", () => expect(isJsonValue(null)).toBe(true));
	it("accepts true and false", () => {
		expect(isJsonValue(true)).toBe(true);
		expect(isJsonValue(false)).toBe(true);
	});
	it("accepts 0 and other numbers", () => {
		expect(isJsonValue(0)).toBe(true);
		expect(isJsonValue(-1.5)).toBe(true);
	});
	it("accepts empty string", () => expect(isJsonValue("")).toBe(true));
	it("accepts a non-empty string", () => expect(isJsonValue("hello")).toBe(true));
	it("accepts empty array", () => expect(isJsonValue([])).toBe(true));
	it("accepts empty object", () => expect(isJsonValue({})).toBe(true));

	it("rejects undefined", () => expect(isJsonValue(undefined)).toBe(false));
	it("rejects Infinity", () => expect(isJsonValue(Infinity)).toBe(false));
	it("rejects -Infinity", () => expect(isJsonValue(-Infinity)).toBe(false));
	it("rejects NaN", () => expect(isJsonValue(Number.NaN)).toBe(false));

	it("rejects sparse arrays", () => {
		// biome-ignore lint/suspicious/noSparseArray: intentional test
		const sparse = [1, , 3];
		expect(isJsonValue(sparse)).toBe(false);
	});

	it("rejects class instances", () => {
		class Foo {}
		expect(isJsonValue(new Foo())).toBe(false);
	});

	it("accepts nested valid JSON structure", () => {
		expect(isJsonValue({ a: [1, "two", null, true] })).toBe(true);
	});
});

describe("isJsonRecord", () => {
	it("accepts empty plain object", () => expect(isJsonRecord({})).toBe(true));
	it("accepts object with JSON values", () => {
		expect(isJsonRecord({ x: 1, y: "two", z: null })).toBe(true);
	});

	it("rejects null", () => expect(isJsonRecord(null)).toBe(false));
	it("rejects arrays", () => expect(isJsonRecord([])).toBe(false));
	it("rejects class instances", () => {
		class Bar {}
		expect(isJsonRecord(new Bar())).toBe(false);
	});
	it("rejects object with non-JSON value (undefined)", () => {
		expect(isJsonRecord({ a: undefined })).toBe(false);
	});
	it("rejects object with non-JSON value (Infinity)", () => {
		expect(isJsonRecord({ n: Infinity })).toBe(false);
	});
});
