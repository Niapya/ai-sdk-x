import type {
	Bash,
	BashExecResult,
	Command,
	ExecOptions,
	IFileSystem,
	MountableFs,
} from "just-bash";
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
	readonly name: string;
	readonly prompt?: (ctx: FeatureSetupContext) => Awaitable<string>;
	readonly command?: Command[];
	readonly hooks?: ExecHook;
}

export interface FeatureConfig {
	readonly enabled: boolean;
}

export interface MountedFeatureOptions {
	fs?: IFileSystem;
	mountPoint?: string;
}

export interface MountedFeatureConfig extends FeatureConfig {
	readonly fs?: IFileSystem;
	readonly mountPoint: string;
}
