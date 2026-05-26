import type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
import { DEFAULT_WORKSPACE_MOUNT } from "@/runtime/constants";
import { initializeMountedFeature, resolveMountedFeatureConfig } from "@/runtime/features";
import type { Feature } from "@/types";

export function createWorkspaceFeature(
	option: boolean | WorkspaceOptions | undefined = true,
): Feature {
	const config: WorkspaceConfig = resolveMountedFeatureConfig(option, DEFAULT_WORKSPACE_MOUNT);

	return {
		name: "workspace",
		prompt: config.enabled
			? () =>
					`Workspace mount: ${config.mountPoint}. Use the mounted workspace to inspect and edit files.`
			: undefined,
		env: config.enabled
			? {
					WORKSPACE_HOME: config.mountPoint,
				}
			: undefined,
		init: config.enabled
			? async (context) => {
					await initializeMountedFeature(context, config, DEFAULT_WORKSPACE_MOUNT);
				}
			: undefined,
	};
}

export type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
