import { describe, expect, it } from "bun:test";
import type { IFileSystem } from "just-bash";
import { InMemoryFs } from "just-bash";
import {
	base64ToBytes,
	bytesToBase64,
	cloneStat,
	createStat,
	decodeText,
	deserializeStat,
	isNotFoundError,
	readBytesFrom,
	serializeStat,
	toBytes,
} from "@/utils/data";

describe("data utils", () => {
	it("round-trips text and base64 payloads", () => {
		const utf8 = toBytes("hello");
		expect(decodeText(utf8)).toBe("hello");

		const base64 = bytesToBase64(new Uint8Array([1, 2, 3]));
		expect(Array.from(base64ToBytes(base64))).toEqual([1, 2, 3]);
	});

	it("serializes and clones stat objects", () => {
		const stat = createStat({
			isFile: true,
			isDirectory: false,
			isSymbolicLink: false,
			mode: 0o600,
			size: 5,
			mtime: new Date("2024-01-01T00:00:00.000Z"),
		});

		const cloned = cloneStat(stat);
		const restored = deserializeStat(serializeStat(stat));

		expect(cloned).toEqual(stat);
		expect(cloned.mtime).not.toBe(stat.mtime);
		expect(restored).toEqual(stat);
	});

	it("reads bytes from either readFileBytes or readFileBuffer", async () => {
		const direct = new InMemoryFs({ "/repo/file.bin": new Uint8Array([65, 66]) });
		expect(Array.from(await readBytesFrom(direct, "/repo/file.bin"))).toEqual([65, 66]);

		const fallbackFs = {
			readFileBuffer: async () => new Uint8Array([67, 68]),
		} as Pick<IFileSystem, "readFileBuffer"> as IFileSystem;
		expect(Array.from(await readBytesFrom(fallbackFs, "/repo/file.bin"))).toEqual([67, 68]);
	});

	it("detects not-found filesystem errors", () => {
		expect(isNotFoundError(new Error("ENOENT: missing"))).toBe(true);
		expect(isNotFoundError(new Error("ENOTDIR: bad"))).toBe(true);
		expect(isNotFoundError(new Error("EACCES: denied"))).toBe(false);
	});
});
