import type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
import { DEFAULT_WORKSPACE_MOUNT } from "@/runtime/constants";
import { initializeMountedFeature, resolveMountedFeatureConfig } from "@/runtime/features";
import type { Feature } from "@/types";

export function createWorkspaceFeature(
	option: boolean | WorkspaceOptions | undefined = true,
): Feature {
	const config: WorkspaceConfig = resolveMountedFeatureConfig(option, DEFAULT_WORKSPACE_MOUNT);
	const feature: Feature = {
		name: "workspace",
	};

	if (!config.enabled) {
		return feature;
	}

	return {
		...feature,
		prompt: () =>
			`Workspace mount: ${config.mountPoint}. Use the mounted workspace to inspect and edit files.`,
		env: {
			WORKSPACE_HOME: config.mountPoint,
		},
		init: async (context) => {
			await initializeMountedFeature(context, config, DEFAULT_WORKSPACE_MOUNT);
		},
	};
}

export type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
