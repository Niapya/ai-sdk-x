import { describe, expect, it } from "bun:test";
import { InMemoryFs } from "just-bash";
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
});
