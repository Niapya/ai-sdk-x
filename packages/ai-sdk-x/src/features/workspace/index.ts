import type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
import { AsyncOnce } from "@/runtime/async-once";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type { ExecHookStartContext, Feature } from "@/types";

export const DEFAULT_WORKSPACE_MOUNT = "/home/user/workspace";

export function createWorkspaceFeatureDescription(mountPoint: string): string {
	return [
		`The workspace feature provides the persistent project filesystem at ${mountPoint}.`,
		"Use `$WORKSPACE_HOME` env to locate this mount.",
		"All durable deliverable files must be inspected, created, modified, moved, or deleted inside this workspace mount.",
		"Do not store files that the user expects as deliverables outside `$WORKSPACE_HOME`; use temporary locations only for scratch work.",
		"For large workspace files, prefer targeted inspection with rg, sed -n, nl -ba, wc -l, file, head, and tail instead of dumping entire files.",
	].join(" ");
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
