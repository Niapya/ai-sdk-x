import { describe, expect, it } from "bun:test";
import { InMemoryFs, latin1FromBytes } from "just-bash";
import { TransactionalFs } from "@/runtime/fs/transactional-fs";

describe("TransactionalFs", () => {
	it("reads pending writes before commit and flushes on commit", async () => {
		const base = new InMemoryFs({
			"/repo/file.txt": "before",
		});
		const fs = new TransactionalFs({ fs: base });

		await fs.writeFile("/repo/file.txt", "after");

		expect(await fs.readFile("/repo/file.txt")).toBe("after");
		expect(await base.readFile("/repo/file.txt")).toBe("before");

		await fs.commit();

		expect(await base.readFile("/repo/file.txt")).toBe("after");
	});

	it("appends in memory and can roll back", async () => {
		const base = new InMemoryFs({
			"/repo/log.txt": "one",
		});
		const fs = new TransactionalFs({ fs: base });

		await fs.appendFile("/repo/log.txt", "\ntwo");
		expect(await fs.readFile("/repo/log.txt")).toBe("one\ntwo");

		await fs.rollback();

		expect(await fs.readFile("/repo/log.txt")).toBe("one");
		expect(await base.readFile("/repo/log.txt")).toBe("one");
	});

	it("masks deleted paths and restores after rollback", async () => {
		const base = new InMemoryFs({
			"/repo/a.txt": "a",
			"/repo/nested/b.txt": "b",
		});
		const fs = new TransactionalFs({ fs: base });

		await fs.rm("/repo", { recursive: true });
		expect(await fs.exists("/repo/a.txt")).toBe(false);
		await expect(fs.readFile("/repo/a.txt")).rejects.toThrow("ENOENT");

		await fs.rollback();
		expect(await fs.readFile("/repo/a.txt")).toBe("a");
	});

	it("merges overlay directories in readdir", async () => {
		const base = new InMemoryFs({
			"/repo/a.txt": "a",
			"/repo/b.txt": "b",
		});
		const fs = new TransactionalFs({ fs: base });

		await fs.rm("/repo/a.txt");
		await fs.writeFile("/repo/c.txt", "c");

		expect(await fs.readdir("/repo")).toEqual(["b.txt", "c.txt"]);
	});

	it("copies and moves recursively without touching the base until commit", async () => {
		const base = new InMemoryFs({
			"/repo/source/file.txt": "hello",
			"/repo/source/nested/child.txt": "child",
		});
		const fs = new TransactionalFs({ fs: base });

		await fs.cp("/repo/source", "/repo/copied", { recursive: true });
		await fs.mv("/repo/copied", "/repo/moved");

		expect(await fs.readFile("/repo/moved/file.txt")).toBe("hello");
		expect(await fs.exists("/repo/copied/file.txt")).toBe(false);
		expect(await base.exists("/repo/moved/file.txt")).toBe(false);

		await fs.commit();

		expect(await base.readFile("/repo/moved/file.txt")).toBe("hello");
		expect(await base.readFile("/repo/moved/nested/child.txt")).toBe("child");
	});

	it("tracks added modified and deleted paths in status", async () => {
		const base = new InMemoryFs({
			"/repo/existing.txt": "value",
			"/repo/remove.txt": "remove",
		});
		const fs = new TransactionalFs({ fs: base });

		await fs.writeFile("/repo/new.txt", "new");
		await fs.writeFile("/repo/existing.txt", "updated");
		await fs.rm("/repo/remove.txt");

		const status = await fs.status();
		expect(status.added).toContain("/repo/new.txt");
		expect(status.modified).toContain("/repo/existing.txt");
		expect(status.deleted).toContain("/repo/remove.txt");
	});

	it("does not keep a deleted parent root after recreating a child path", async () => {
		const base = new InMemoryFs({
			"/repo/old.txt": "old",
		});
		const fs = new TransactionalFs({ fs: base });

		await fs.rm("/repo", { recursive: true });
		await fs.writeFile("/repo/new.txt", "new");

		expect(await fs.readFile("/repo/new.txt")).toBe("new");
		expect(await fs.status()).toEqual({
			added: ["/repo/new.txt"],
			modified: ["/repo"],
			deleted: ["/repo/old.txt"],
		});

		await fs.commit();
		expect(await base.readFile("/repo/new.txt")).toBe("new");
		expect(await base.exists("/repo/old.txt")).toBe(false);
	});

	it("reads overlay content as bytes and requested encodings", async () => {
		const base = new InMemoryFs();
		const fs = new TransactionalFs({ fs: base });

		await fs.writeFile("/repo/data.bin", new Uint8Array([0xde, 0xad, 0xbe, 0xef]));

		expect(await fs.readFile("/repo/data.bin", "hex")).toBe("deadbeef");
		expect(await fs.readFile("/repo/data.bin", "base64")).toBe("3q2+7w==");
		expect(latin1FromBytes(await fs.readFileBytes("/repo/data.bin"))).toBe("\xDE\xAD\xBE\xEF");
	});

	it("stages symlinks, hard links, chmod, utimes, lstat, readlink, and realpath", async () => {
		const base = new InMemoryFs({
			"/repo/file.txt": "value",
		});
		const fs = new TransactionalFs({ fs: base });
		const mtime = new Date("2026-04-05T06:07:08.000Z");

		await fs.symlink("/repo/file.txt", "/repo/link.txt");
		await fs.link("/repo/file.txt", "/repo/hard.txt");
		await fs.chmod("/repo/file.txt", 0o600);
		await fs.utimes("/repo/file.txt", mtime, mtime);

		expect((await fs.lstat("/repo/link.txt")).isSymbolicLink).toBe(true);
		expect(await fs.readlink("/repo/link.txt")).toBe("/repo/file.txt");
		expect(await fs.realpath("/repo/link.txt")).toBe("/repo/link.txt");
		expect(await fs.readFile("/repo/hard.txt")).toBe("value");
		expect((await fs.stat("/repo/file.txt")).mode).toBe(0o600);
		expect((await fs.stat("/repo/file.txt")).mtime.toISOString()).toBe(mtime.toISOString());

		await fs.commit();
		expect(await base.readlink("/repo/link.txt")).toBe("/repo/file.txt");
		expect(await base.readFile("/repo/hard.txt")).toBe("value");
	});

	it("rejects directory reads, non-recursive directory copies, and hard links to directories", async () => {
		const base = new InMemoryFs({
			"/repo/dir/file.txt": "value",
		});
		const fs = new TransactionalFs({ fs: base });

		await expect(fs.readFile("/repo/dir")).rejects.toThrow("EISDIR");
		await expect(fs.cp("/repo/dir", "/repo/copy")).rejects.toThrow("ERR_FS_CP_EISDIR");
		await expect(fs.link("/repo/dir", "/repo/dir-link")).rejects.toThrow("EISDIR");
	});
});
