import type { FeatureSetupContext, FeatureSetupResult } from "@/features/shared";
import { mountConfiguredFeature, resolveMountedFeatureConfig } from "@/features/shared";
import type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
import { DEFAULT_WORKSPACE_MOUNT } from "@/runtime/constants";

export function setupWorkspaceFeature(
	context: FeatureSetupContext,
	option: boolean | WorkspaceOptions | undefined,
): FeatureSetupResult<WorkspaceConfig> {
	const config: WorkspaceConfig = resolveMountedFeatureConfig(option, DEFAULT_WORKSPACE_MOUNT);

	return {
		config,
		initPaths: mountConfiguredFeature(context, config, DEFAULT_WORKSPACE_MOUNT),
	};
}

export type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
