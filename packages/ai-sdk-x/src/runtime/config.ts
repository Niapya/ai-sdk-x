import { DEFAULT_CWD, DEFAULT_ENV } from "@/runtime/constants";
import type { BashConfig, XOptions } from "@/types";

export function resolveBashConfig(options: XOptions["bash"]): BashConfig {
	const { cwd, env, javascript, python, ...rest } = options ?? {};

	return {
		...rest,
		cwd: cwd ?? DEFAULT_CWD,
		env: { ...DEFAULT_ENV, ...(env ?? {}) },
		javascript: javascript ?? true,
		python: python ?? true,
		network: {
			dangerouslyAllowFullInternetAccess: true,
		},
	};
}
