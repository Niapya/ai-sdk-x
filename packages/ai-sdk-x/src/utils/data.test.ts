import { describe, expect, it } from "bun:test";
import type { IFileSystem } from "just-bash";
import { InMemoryFs } from "just-bash";
import {
	base64ToBytes,
	bytesToBase64,
	bytesToLatin1,
	cloneBytes,
	cloneStat,
	createStat,
	decodeText,
	deserializeStat,
	fromByteString,
	isNotFoundError,
	isSameOrDescendant,
	latin1ToBytes,
	readBytesFrom,
	serializeStat,
	toByteString,
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

describe("latin1 encoding roundtrip", () => {
	it("roundtrips ASCII bytes", () => {
		const bytes = new Uint8Array([65, 66, 67]);
		expect(latin1ToBytes(bytesToLatin1(bytes))).toEqual(bytes);
	});

	it("masks high bytes to 0xFF in latin1ToBytes", () => {
		// charCodeAt('þ') = 254, 254 & 0xff = 254
		const result = latin1ToBytes("þÿ");
		expect(result[0]).toBe(254);
		expect(result[1]).toBe(255);
	});

	it("bytesToLatin1 produces one char per byte", () => {
		const bytes = new Uint8Array([0, 127, 255]);
		const str = bytesToLatin1(bytes);
		expect(str.length).toBe(3);
		expect(str.charCodeAt(0)).toBe(0);
		expect(str.charCodeAt(2)).toBe(255);
	});
});

describe("hex encoding via toBytes / decodeText", () => {
	it("encodes to hex and decodes back", () => {
		const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
		const hexStr = decodeText(bytes, "hex");
		expect(hexStr).toBe("deadbeef");
		expect(Array.from(toBytes(hexStr, "hex"))).toEqual([0xde, 0xad, 0xbe, 0xef]);
	});
});

describe("cloneBytes", () => {
	it("produces an equal but distinct array", () => {
		const original = new Uint8Array([1, 2, 3]);
		const clone = cloneBytes(original);
		expect(clone).toEqual(original);
		clone[0] = 99;
		expect(original[0]).toBe(1);
	});
});

describe("isSameOrDescendant", () => {
	it("returns true for identical paths", () => {
		expect(isSameOrDescendant("/home/user", "/home/user")).toBe(true);
	});

	it("returns true for a child path", () => {
		expect(isSameOrDescendant("/home/user", "/home/user/docs/file.txt")).toBe(true);
	});

	it("returns false for a sibling path", () => {
		expect(isSameOrDescendant("/home/user", "/home/other")).toBe(false);
	});

	it("returns false for a parent path", () => {
		expect(isSameOrDescendant("/home/user", "/home")).toBe(false);
	});
});

describe("toByteString / fromByteString roundtrip", () => {
	it("roundtrips ASCII bytes through ByteString", () => {
		const bytes = new Uint8Array([72, 101, 108, 108, 111]);
		const bs = toByteString(bytes);
		expect(Array.from(fromByteString(bs))).toEqual(Array.from(bytes));
	});
});
