import type { BashConfig, XOptions } from "@/types";

export function resolveBashConfig(options: XOptions["bash"]): BashConfig {
	const { cwd, env, javascript, network, python, ...rest } = options ?? {};

	return {
		...rest,
		cwd: cwd ?? "/home/user",
		env: { ...(env ?? {}) },
		javascript: javascript ?? true,
		network:
			network === undefined
				? {
						dangerouslyAllowFullInternetAccess: true,
					}
				: network,
		python: python ?? true,
	};
}
