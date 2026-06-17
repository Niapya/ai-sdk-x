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

export interface FeatureInstructions {
	/**
	 * Stable instructions for the model. Put durable rules, command semantics,
	 * safety policies, and workflow guidance here.
	 *
	 * This content is intended for the system prompt and should avoid values that
	 * change between calls, so applications can move it into prompt-cached
	 * prefixes when the provider supports prompt caching.
	 */
	readonly guidance?: string;
	/**
	 * Current runtime information for the model. Put mounted paths, discovered
	 * files, available resources, indexes, and other state that can change between
	 * calls here.
	 *
	 * This content is intended for the Bash tool description, especially when
	 * `getTools({ enableDescription: false })` is used to keep only environment
	 * metadata in tool descriptions.
	 */
	readonly environment?: string;
}

/**
 * Feature description output.
 *
 * Prefer returning `FeatureInstructions` so stable guidance and changing
 * environment state can be routed separately. A plain string is supported for
 * backwards compatibility and is treated as `environment`, not `guidance`.
 */
export type FeatureDescriptionResult = string | FeatureInstructions;

export interface Feature {
	/**
	 * Stable feature identifier used for registration, diagnostics, and tests.
	 */
	readonly name: string;
	/**
	 * Optional model-facing instructions produced when the feature is enabled.
	 *
	 * Return `{ guidance, environment }` when possible. Both properties are
	 * optional: fixed features can return only `guidance`, stateful features can
	 * return only `environment`, and disabled/no-op features can omit
	 * `description`.
	 *
	 * Plain strings are treated as environment instructions for backwards
	 * compatibility. New features should avoid returning a plain string.
	 */
	readonly description?: (ctx: FeatureSetupContext) => Awaitable<FeatureDescriptionResult>;
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
