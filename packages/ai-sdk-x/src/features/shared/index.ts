import type { Command, IFileSystem, MountableFs } from "just-bash";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";

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

export interface FeatureSetupContext {
	readonly baseFs: IFileSystem;
	readonly fs: MountableFs;
}

export interface FeatureSetupResult<TConfig extends FeatureConfig = FeatureConfig> {
	readonly command?: Command;
	readonly config: TConfig;
	readonly initPaths: string[];
	readonly initialize?: () => Promise<void>;
}

export function resolveFeatureEnabled(option: boolean | object | undefined): boolean {
	return option !== false;
}

export function resolveFeatureOption<TOptions>(
	option: boolean | TOptions | undefined,
): TOptions | undefined {
	return typeof option === "object" ? option : undefined;
}

export function resolveMountedFeatureConfig<TOptions extends MountedFeatureOptions>(
	option: boolean | TOptions | undefined,
	defaultMount: string,
): MountedFeatureConfig {
	const resolvedOption = resolveFeatureOption(option);

	return {
		enabled: resolveFeatureEnabled(option),
		fs: resolvedOption?.fs,
		mountPoint: resolvedOption?.mountPoint ?? defaultMount,
	};
}

export function mountConfiguredFeature(
	context: FeatureSetupContext,
	config: MountedFeatureConfig,
	sourceRoot: string,
): string[] {
	if (!config.enabled) {
		return [];
	}

	if (config.fs) {
		context.fs.mount(config.mountPoint, config.fs);
		return [];
	}

	if (config.mountPoint !== sourceRoot) {
		context.fs.mount(config.mountPoint, createSubpathFs(context.baseFs, sourceRoot));
	}

	return [sourceRoot];
}

export async function initializeFeatureSetups(
	baseFs: IFileSystem,
	results: ReadonlyArray<FeatureSetupResult>,
): Promise<void> {
	const initPaths = Array.from(new Set(results.flatMap((result) => result.initPaths)));
	await Promise.all(initPaths.map((path) => baseFs.mkdir(path, { recursive: true })));
	await Promise.all(results.flatMap((result) => (result.initialize ? [result.initialize()] : [])));
}
