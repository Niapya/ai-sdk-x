import {
	DEFAULT_CWD,
	DEFAULT_ENV,
	DEFAULT_MEMORY_MOUNT,
	DEFAULT_SKILLS_MOUNT,
	DEFAULT_WORKSPACE_MOUNT,
} from "@/runtime/constants";
import type {
	BashConfig,
	MemoryConfig,
	MemoryOptions,
	SkillsConfig,
	SkillsOptions,
	WorkspaceConfig,
	WorkspaceOptions,
	XConfig,
	XOptions,
} from "@/types";

export function resolveConfig(options: XOptions): XConfig {
	return {
		bash: resolveBashConfig(options.bash),
		workspace: resolveWorkspaceConfig(options.workspace),
		skills: resolveSkillsConfig(options.skills),
		memory: resolveMemoryConfig(options.memory),
	};
}

function resolveBashConfig(options: XOptions["bash"]): BashConfig {
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

function resolveWorkspaceConfig(option: XOptions["workspace"]): WorkspaceConfig {
	return {
		enabled: option !== false,
		fs: typeof option === "object" ? option.fs : undefined,
		mountPoint: optionMount(option, DEFAULT_WORKSPACE_MOUNT),
	};
}

function resolveSkillsConfig(option: XOptions["skills"]): SkillsConfig {
	return {
		enabled: option !== false,
		cache: typeof option === "object" ? option.cache : undefined,
		fs: typeof option === "object" ? option.fs : undefined,
		lockfile: typeof option === "object" ? (option.lockfile ?? true) : true,
		mountPoint: optionMount(option, DEFAULT_SKILLS_MOUNT),
	};
}

function resolveMemoryConfig(option: XOptions["memory"]): MemoryConfig {
	return {
		enabled: option !== false,
		cache: typeof option === "object" ? option.cache : undefined,
		fs: typeof option === "object" ? option.fs : undefined,
		mountPoint: optionMount(option, DEFAULT_MEMORY_MOUNT),
	};
}

function optionMount(
	option: boolean | MemoryOptions | SkillsOptions | WorkspaceOptions | undefined,
	defaultMount: string,
): string {
	if (option === false) {
		return defaultMount;
	}
	if (typeof option === "object" && option.mountPoint) {
		return option.mountPoint;
	}
	return defaultMount;
}
