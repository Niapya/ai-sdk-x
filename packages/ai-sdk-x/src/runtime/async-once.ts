export class AsyncOnce<Args extends unknown[] = []> {
	private done = false;
	private promise: Promise<void> | null = null;

	constructor(
		private readonly fn: (...args: Args) => Promise<void> | void,
		private readonly options: {
			retryOnFailure?: boolean;
		} = {},
	) {}

	run = (...args: Args): Promise<void> => {
		if (this.done) {
			return Promise.resolve();
		}

		if (!this.promise) {
			this.promise = Promise.resolve()
				.then(() => this.fn(...args))
				.then(() => {
					this.done = true;
				})
				.catch((error) => {
					if (this.options.retryOnFailure) {
						this.promise = null;
					}

					throw error;
				});
		}

		return this.promise;
	};
}
