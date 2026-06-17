import type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type { Feature, FeatureInstructions, FeatureSetupContext } from "@/types";

export const DEFAULT_WORKSPACE_MOUNT = "/home/user/workspace";
const WORKSPACE_TREE_MAX_DEPTH = 5;
const WORKSPACE_AGENT_FILENAMES = ["agents.md", "agent.md", "claude.md"] as const;

export async function createWorkspaceFeatureDescription(
	ctx: FeatureSetupContext,
	mountPoint: string,
	loadAgentsMd = true,
	treeMaxDepth = WORKSPACE_TREE_MAX_DEPTH,
): Promise<FeatureInstructions> {
	const workspaceTree = await describeWorkspaceTree(ctx, mountPoint, treeMaxDepth);
	const workspaceAgentInstructions = loadAgentsMd
		? await describeWorkspaceAgentInstructions(ctx, mountPoint)
		: "";
	return {
		guidance: [
			"IMPORTANT: ALL DURABLE WORK FILES AND DELIVERABLES MUST BE STORED UNDER `$WORKSPACE_HOME`.",
			"Inspect, create, modify, move, and delete user-facing work files inside `$WORKSPACE_HOME`; do not place deliverables elsewhere.",
			"Use temporary locations only for scratch data that should not be delivered.",
			"Inspect large files with targeted commands such as `rg`, `grep -n`, `sed -n`, `nl -ba`, `wc -l`, `head`, and `tail`.",
			"Read the workspace root `agents.md` file if present. `agents.md` is the agent instructions file convention. Treat nested AGENTS.md files in subprojects as agent-owned and read them only when you enter that subproject.",
		].join("\n"),
		environment: [
			"I am working in a workspace with the following folders:",
			`- The $WORKSPACE_HOME is ${mountPoint}, which has the following structure:`,
			"```text",
			workspaceTree,
			"```",
			workspaceAgentInstructions,
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
		loadAgentsMd: resolvedOption?.loadAgentsMd ?? true,
		treeMaxDepth: resolvedOption?.treeMaxDepth ?? WORKSPACE_TREE_MAX_DEPTH,
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
			return createWorkspaceFeatureDescription(
				ctx,
				config.mountPoint,
				config.loadAgentsMd,
				config.treeMaxDepth,
			);
		},
		hooks: {
			onExecStart: initialize,
		},
	};
}

async function describeWorkspaceTree(
	ctx: FeatureSetupContext,
	mountPoint: string,
	treeMaxDepth: number,
): Promise<string> {
	const result = await ctx.bash.exec(`tree -L ${treeMaxDepth} ${mountPoint}`);
	const output = result.stdout.trimEnd();
	if (result.exitCode === 0 && output) {
		return output;
	}

	return `${mountPoint}\n\`-- (empty or tree command not available)`;
}

async function describeWorkspaceAgentInstructions(
	ctx: FeatureSetupContext,
	mountPoint: string,
): Promise<string> {
	const filenames = await listWorkspaceRootFiles(ctx, mountPoint);
	for (const path of resolveWorkspaceAgentInstructionPaths(ctx, mountPoint, filenames)) {
		if (!(await ctx.fs.exists(path))) {
			continue;
		}

		const content = await ctx.fs.readFile(path);
		const body = content.toString().trimEnd();
		if (!body) {
			continue;
		}

		return [
			`Workspace root agent instructions file \`${path}\` is as follows:`,
			"```md",
			body,
			"```",
		].join("\n");
	}

	return "";
}

async function listWorkspaceRootFiles(
	ctx: FeatureSetupContext,
	mountPoint: string,
): Promise<string[]> {
	try {
		return await ctx.fs.readdir(mountPoint);
	} catch {
		return [];
	}
}

function resolveWorkspaceAgentInstructionPaths(
	ctx: FeatureSetupContext,
	mountPoint: string,
	filenames: string[],
): string[] {
	for (const candidate of WORKSPACE_AGENT_FILENAMES) {
		const match = filenames.find((filename) => filename.toLowerCase() === candidate);
		if (match) {
			return [ctx.fs.resolvePath(mountPoint, match)];
		}
	}

	return [];
}

export type { WorkspaceConfig, WorkspaceOptions } from "@/features/workspace/types";
