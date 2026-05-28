export class AsyncOnce {
	private done = false;
	private promise: Promise<void> | null = null;

	constructor(
		private readonly fn: () => Promise<void> | void,
		private readonly options: {
			retryOnFailure?: boolean;
		} = {},
	) {}

	run(): Promise<void> {
		if (this.done) {
			return Promise.resolve();
		}

		if (!this.promise) {
			this.promise = Promise.resolve()
				.then(() => this.fn())
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
	}
}
