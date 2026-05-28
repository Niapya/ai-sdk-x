import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type { FeatureSetupContext, MountedFeatureConfig, MountedFeatureOptions } from "@/types";

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

export async function initializeMountedFeature(
	context: FeatureSetupContext,
	config: MountedFeatureConfig,
	sourceRoot: string,
): Promise<void> {
	if (!config.enabled) {
		return;
	}

	if (config.fs) {
		context.fs.mount(config.mountPoint, config.fs);
		return;
	}

	if (config.mountPoint !== sourceRoot) {
		context.fs.mount(config.mountPoint, createSubpathFs(context.fs, sourceRoot));
	}

	await context.fs.mkdir(sourceRoot, { recursive: true });
}
