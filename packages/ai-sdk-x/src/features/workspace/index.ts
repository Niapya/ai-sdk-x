import type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
import { AsyncOnce } from "@/runtime/async-once";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type { ExecHookStartContext, Feature } from "@/types";

export const DEFAULT_WORKSPACE_MOUNT = "/home/user/workspace";

export function createWorkspaceFeature(
	option: boolean | WorkspaceOptions | undefined = true,
): Feature {
	const resolvedOption = typeof option === "object" ? option : undefined;
	const config: WorkspaceConfig = {
		enabled: option !== false,
		fs: resolvedOption?.fs,
		mountPoint: resolvedOption?.mountPoint ?? DEFAULT_WORKSPACE_MOUNT,
	};
	const feature: Feature = {
		name: "workspace",
	};

	if (!config.enabled) {
		return feature;
	}

	const initialize = new AsyncOnce<[ExecHookStartContext]>(async (context) => {
		if (config.fs) {
			context.fs.mount(config.mountPoint, config.fs);
		} else {
			if (config.mountPoint !== DEFAULT_WORKSPACE_MOUNT) {
				context.fs.mount(config.mountPoint, createSubpathFs(context.fs, DEFAULT_WORKSPACE_MOUNT));
			}

			await context.fs.mkdir(DEFAULT_WORKSPACE_MOUNT, { recursive: true });
		}

		context.setEnv("WORKSPACE_HOME", config.mountPoint);
	});

	return {
		...feature,
		prompt: () =>
			`Workspace mount: ${config.mountPoint}. Use the mounted workspace to inspect and edit files.`,
		hooks: {
			onExecStart: (context) => initialize.run(context),
		},
	};
}

export type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
