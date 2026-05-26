import type { Bash, Command, IFileSystem, MountableFs } from "just-bash";
import type { Awaitable } from "@/types/utils";

export interface FeatureSetupContext {
	readonly baseFs: IFileSystem;
	readonly bash: Bash;
	readonly fs: MountableFs;
}

export interface Feature {
	readonly name: string;
	readonly prompt?: (ctx: FeatureSetupContext) => Awaitable<string>;
	readonly command?: Command[];
	readonly env?: Record<string, string>;
	readonly init?: (ctx: FeatureSetupContext) => Awaitable<void>;
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
