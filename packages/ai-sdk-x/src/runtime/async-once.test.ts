import { describe, expect, it } from "bun:test";
import { AsyncOnce } from "@/runtime/async-once";

describe("AsyncOnce", () => {
	it("runs the function only once after success", async () => {
		let count = 0;
		const once = new AsyncOnce(() => {
			count += 1;
		});

		await once.run();
		await once.run();

		expect(count).toBe(1);
	});

	it("deduplicates concurrent runs", async () => {
		let count = 0;
		const once = new AsyncOnce(async () => {
			count += 1;
			await Promise.resolve();
		});

		await Promise.all([once.run(), once.run(), once.run()]);

		expect(count).toBe(1);
	});

	it("retries after failure when retryOnFailure is true", async () => {
		let count = 0;
		const once = new AsyncOnce(
			() => {
				count += 1;
				if (count === 1) {
					throw new Error("boom");
				}
			},
			{ retryOnFailure: true },
		);

		await expect(once.run()).rejects.toThrow("boom");
		await once.run();

		expect(count).toBe(2);
	});

	it("reuses failed promise when retryOnFailure is false", async () => {
		let count = 0;
		const once = new AsyncOnce(() => {
			count += 1;
			throw new Error("boom");
		});

		await expect(once.run()).rejects.toThrow("boom");
		await expect(once.run()).rejects.toThrow("boom");

		expect(count).toBe(1);
	});
});
