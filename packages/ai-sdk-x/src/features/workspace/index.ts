import type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type { Feature, FeatureInstructions, FeatureSetupContext } from "@/types";

export const DEFAULT_WORKSPACE_MOUNT = "/home/user/workspace";
const WORKSPACE_TREE_MAX_DEPTH = 5;

export async function createWorkspaceFeatureDescription(
	ctx: FeatureSetupContext,
	mountPoint: string,
): Promise<FeatureInstructions> {
	const workspaceTree = await describeWorkspaceTree(ctx, mountPoint);
	return {
		guidance: [
			"IMPORTANT: ALL DURABLE WORK FILES AND DELIVERABLES MUST BE STORED UNDER `$WORKSPACE_HOME`.",
			"Inspect, create, modify, move, and delete user-facing work files inside `$WORKSPACE_HOME`; do not place deliverables elsewhere.",
			"Use temporary locations only for scratch data that should not be delivered.",
			"Inspect large files with targeted commands such as `rg`, `grep -n`, `sed -n`, `nl -ba`, `wc -l`, `head`, and `tail`.",
		].join("\n"),
		environment: [
			"I am working in a workspace with the following folders:",
			`- The $WORKSPACE_HOME is ${mountPoint}, which has the following structure:`,
			"```text",
			workspaceTree,
			"```",
		].join("\n"),
	};
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

	const initialize = async (context: FeatureSetupContext) => {
		if (config.fs) {
			context.fs.mount(config.mountPoint, config.fs);
		} else {
			if (config.mountPoint !== DEFAULT_WORKSPACE_MOUNT) {
				context.fs.mount(config.mountPoint, createSubpathFs(context.fs, DEFAULT_WORKSPACE_MOUNT));
			}

			await context.fs.mkdir(DEFAULT_WORKSPACE_MOUNT, { recursive: true });
		}

		context.setEnv("WORKSPACE_HOME", config.mountPoint);
	};

	return {
		name: "workspace",
		description: async (ctx) => {
			await initialize(ctx);
			return createWorkspaceFeatureDescription(ctx, config.mountPoint);
		},
		hooks: {
			onExecStart: initialize,
		},
	};
}

async function describeWorkspaceTree(
	ctx: FeatureSetupContext,
	mountPoint: string,
): Promise<string> {
	const result = await ctx.bash.exec(`tree -L ${WORKSPACE_TREE_MAX_DEPTH} ${mountPoint}`);
	const output = result.stdout.trimEnd();
	if (result.exitCode === 0 && output) {
		return output;
	}

	return `${mountPoint}\n\`-- (empty or tree command not available)`;
}

export type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
