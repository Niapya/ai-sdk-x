import { describe, expect, it } from "bun:test";
import { InMemoryFs } from "just-bash";
import { BootstrappableMountableFs } from "@/runtime/fs/bootstrappable-mountable-fs";

describe("BootstrappableMountableFs", () => {
	it("exposes sync write methods when the base fs supports just-bash bootstrap writes", async () => {
		const fs = new BootstrappableMountableFs({ base: new InMemoryFs() });

		expect(typeof fs.mkdirSync).toBe("function");
		expect(typeof fs.writeFileSync).toBe("function");
		expect(typeof fs.writeFileLazy).toBe("function");

		fs.mkdirSync?.("/tmp/demo", { recursive: true });
		fs.writeFileSync?.("/tmp/demo/file.txt", "hello");

		expect(await fs.readFile("/tmp/demo/file.txt")).toBe("hello");
	});

	it("routes sync bootstrap writes into mounted filesystems", async () => {
		const mounted = new InMemoryFs();
		const fs = new BootstrappableMountableFs({
			base: new InMemoryFs(),
			mounts: [{ mountPoint: "/mnt/data", filesystem: mounted }],
		});

		fs.mkdirSync?.("/mnt/data/demo", { recursive: true });
		fs.writeFileSync?.("/mnt/data/demo/file.txt", "mounted");

		expect(await mounted.readFile("/demo/file.txt")).toBe("mounted");
		expect(await fs.readFile("/mnt/data/demo/file.txt")).toBe("mounted");
	});
});
