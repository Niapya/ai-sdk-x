import type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
import { AsyncOnce } from "@/runtime/async-once";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type { ExecHookStartContext, Feature } from "@/types";

export const DEFAULT_WORKSPACE_MOUNT = "/home/user/workspace";

export function createWorkspaceFeatureDescription(mountPoint: string): string {
	return [
		`Persistent workspace mount: ${mountPoint}.`,
		"IMPORTANT: ALL DURABLE WORK FILES AND DELIVERABLES MUST BE STORED UNDER `$WORKSPACE_HOME`.",
		"Inspect, create, modify, move, and delete user-facing work files inside `$WORKSPACE_HOME`; do not place deliverables elsewhere.",
		"Use temporary locations only for scratch data that should not be delivered.",
		"Inspect large files with targeted commands such as `rg`, `grep -n`, `sed -n`, `nl -ba`, `wc -l`, `head`, and `tail`.",
	].join("\n");
}

export function createWorkspaceFeature(
	option: boolean | WorkspaceOptions | undefined = true,
): Feature {
	const resolvedOption = typeof option === "object" ? option : undefined;
	const config: WorkspaceConfig = {
		enabled: option !== false,
		fs: resolvedOption?.fs,
		mountPoint: resolvedOption?.mountPoint ?? DEFAULT_WORKSPACE_MOUNT,
	};

	if (!config.enabled) {
		return {
			name: "workspace",
		};
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
		name: "workspace",
		description: () => createWorkspaceFeatureDescription(config.mountPoint),
		hooks: {
			onExecStart: (context) => initialize.run(context),
		},
	};
}

export type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
