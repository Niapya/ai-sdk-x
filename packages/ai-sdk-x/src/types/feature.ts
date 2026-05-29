import type { Bash, BashExecResult, Command, ExecOptions, MountableFs } from "just-bash";
import type { EnvSnapshot } from "@/runtime/env";
import type { Awaitable } from "@/types/utils";

export interface FeatureSetupContext {
	readonly bash: Bash;
	readonly fs: MountableFs;
	setEnv(key: string, value: string): void;
}

export interface ExecHookContext {
	readonly command: string;
	readonly options?: Pick<ExecOptions, "cwd" | "env" | "replaceEnv" | "stdin" | "stdinKind">;
	readonly snapshot: EnvSnapshot;
}

export interface ExecHookStartContext extends FeatureSetupContext, ExecHookContext {}

export interface ExecHookResultContext extends ExecHookContext {
	readonly result: BashExecResult;
}

export interface ExecHook {
	onExecStart?(ctx: ExecHookStartContext): Awaitable<void>;
	onExecEnd?(ctx: ExecHookResultContext): Awaitable<void>;
}

export interface Feature {
	/**
	 * Stable feature identifier used for registration, diagnostics, and tests.
	 */
	readonly name: string;
	/**
	 * Optional model-facing description appended to the bash tool description when
	 * the feature is enabled. Built-in features should return plain description
	 * text. The top-level tool description is responsible for wrapping feature
	 * metadata in XML.
	 */
	readonly description?: (ctx: FeatureSetupContext) => Awaitable<string>;
	/**
	 * Commands made available inside the virtual bash runtime while this feature is
	 * enabled.
	 */
	readonly command?: Command[];
	/**
	 * Execution lifecycle hooks used to initialize mounts, set feature-owned env,
	 * or observe command results.
	 */
	readonly hooks?: ExecHook;
}
