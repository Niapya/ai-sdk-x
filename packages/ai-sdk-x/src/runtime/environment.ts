import type { Environment } from "@/types";

export class MemoryEnvironment implements Environment {
	#env: Record<string, string>;

	constructor(env: Record<string, string> = {}) {
		this.#env = { ...env };
	}

	get(): Record<string, string> {
		return { ...this.#env };
	}

	set(env: Record<string, string>): void {
		this.#env = { ...env };
	}
}

export function createEnvironment(env?: Environment): Environment {
	return env ?? new MemoryEnvironment();
}

export async function resolveEnvironmentSnapshot(
	environment: Environment,
	initialEnv: Record<string, string>,
): Promise<Record<string, string>> {
	const currentEnv = await environment.get();
	return {
		...currentEnv,
		...initialEnv,
	};
}

export async function persistEnvironmentSnapshot(
	environment: Environment,
	initialEnv: Record<string, string>,
	nextEnv: Record<string, string>,
): Promise<void> {
	const persistedEnv = { ...nextEnv };

	for (const key of Object.keys(initialEnv)) {
		delete persistedEnv[key];
	}

	await environment.set(persistedEnv);
}