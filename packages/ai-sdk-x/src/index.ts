import {
	Bash,
	type BashExecResult,
	type BashOptions,
	type Command,
	type ExecOptions,
	type IFileSystem,
	InMemoryFs,
	MountableFs,
} from "just-bash";
import { createGitFeature } from "@/features/git";
import { createMemoryFeature } from "@/features/memory";
import { createPatchFeature } from "@/features/patch";
import { createSkillsFeature, parseSkillInstallTarget } from "@/features/skills";
import { createWorkspaceFeature } from "@/features/workspace";
import { resolveBashConfig } from "@/runtime/config";
import {
	createEnvironment,
	persistEnvironmentSnapshot,
	resolveEnvironmentSnapshot,
} from "@/runtime/environment";
import {
	createFeatureRuntimeState,
	ensureRuntimeFeaturesInitialized,
	type FeatureRuntimeState,
	listRuntimeCommands,
	listRuntimeFeatures,
	registerRuntimeCommand,
	registerRuntimeFeature,
	resolveRuntimeFeatureEnv,
} from "@/runtime/features";
import { MAX_OUTPUT } from "@/runtime/output";
import { createBashTool, createToolDescription } from "@/runtime/tools";

export {
	createGitFeature,
	createMemoryFeature,
	createPatchFeature,
	createSkillsFeature,
	createWorkspaceFeature,
	parseSkillInstallTarget,
};
export type { MemoryFeature } from "@/features/memory";
export type { SkillsFeature } from "@/features/skills";
export type {
	CliCommandDefinition,
	CliDefinition,
	CliTopicDefinition,
	CommandArgDefinition,
	CommandFlagDefinition,
	CommandInput,
	HelpInfo,
} from "@/utils";
export { createCommand, defineCliCommand, defineCliTopic } from "@/utils";

import type {
	DefaultFeatureOptions,
	Environment,
	Feature,
	GetToolsOptions,
	XOptions,
} from "@/types";

export type {
	BashConfig,
	DefaultFeatureOptions,
	Environment,
	Feature,
	FeatureConfig,
	FeatureSetupContext,
	GetToolsOptions,
	GitConfig,
	GitOptions,
	KVStorage,
	MemoryConfig,
	MemoryOptions,
	MountedFeatureConfig,
	MountedFeatureOptions,
	PatchConfig,
	PatchOptions,
	SkillsConfig,
	SkillsOptions,
	WorkspaceConfig,
	WorkspaceOptions,
	XOptions,
} from "@/types";
export { MAX_OUTPUT };
export type {
	CachingFsOptions,
	IndexedFsOptions,
	TransactionalFsOptions,
	TransactionalFsStatus,
} from "@/runtime/fs";
export {
	CachingFs,
	IndexedFs,
	TransactionalFs,
} from "@/runtime/fs";
export type { InMemoryKVStoreOptions } from "@/runtime/storage";
export { InMemoryKVStore } from "@/runtime/storage";
export type { FsDirent } from "@/utils";

export class X {
	readonly bash: Bash;
	readonly commands: Command[];
	readonly env: Environment;
	readonly fs: IFileSystem;
	private readonly runtimeState: FeatureRuntimeState;

	constructor(options: XOptions = {}) {
		const bashConfig = resolveBashConfig(options.bash);
		this.env = createEnvironment(options.env);

		const baseFs = options.fs ?? new InMemoryFs();
		const mountableFs = new MountableFs({ base: baseFs });
		this.fs = mountableFs;
		this.commands = [];

		const runtimeState = createFeatureRuntimeState(baseFs, mountableFs, bashConfig);
		this.runtimeState = runtimeState;

		const bashOptions: BashOptions = {
			...this.runtimeState.bashConfig,
			fs: mountableFs,
		};
		this.bash = new Bash(bashOptions);
	}

	/**
	 * Convenience init
	 *
	 * It is equipped with Git, Workspace, Skills, Memory, and Patch.
	 */
	static init(options: XOptions & DefaultFeatureOptions = {}): X {
		const { git, memory, patch, skills, workspace, ...baseOptions } = options;
		const x = new X(baseOptions);

		x.registerFeature(createGitFeature(git));
		x.registerFeature(createWorkspaceFeature(workspace));
		x.registerFeature(createSkillsFeature(skills));
		x.registerFeature(createMemoryFeature(memory));
		x.registerFeature(createPatchFeature(patch));

		return x;
	}

	async exec(command: string, options?: ExecOptions): Promise<BashExecResult> {
		const runtimeState = this.runtimeState;

		await ensureRuntimeFeaturesInitialized(runtimeState, () => ({
			baseFs: runtimeState.baseFs,
			bash: this.bash,
			fs: runtimeState.fs,
		}));

		const shellEnv = resolveShellEnv(runtimeState);
		const baseEnv = await resolveEnvironmentSnapshot(this.env, shellEnv);
		const execEnv = options?.replaceEnv
			? { ...(options.env ?? {}), ...shellEnv }
			: { ...baseEnv, ...(options?.env ?? {}) };
		const execCwd = options?.cwd ?? execEnv.PWD ?? runtimeState.bashConfig.cwd;
		const result = await this.bash.exec(command, {
			...options,
			cwd: execCwd,
			env: execEnv,
			replaceEnv: true,
		});

		await persistEnvironmentSnapshot(this.env, shellEnv, result.env);
		return result;
	}

	registerCommand(command: Command): this {
		const runtimeState = this.runtimeState;
		registerRuntimeCommand(runtimeState, this.bash, command);
		syncCommands(this, runtimeState);
		return this;
	}

	registerFeature(feature: Feature): void {
		const runtimeState = this.runtimeState;
		registerRuntimeFeature(runtimeState, this.bash, feature);
		syncCommands(this, runtimeState);
	}

	async getTools(
		options: GetToolsOptions = {},
	): Promise<{ bash: Awaited<ReturnType<typeof createBashTool>> }> {
		const runtimeState = this.runtimeState;
		const featureContext = {
			baseFs: runtimeState.baseFs,
			bash: this.bash,
			fs: runtimeState.fs,
		};
		const description = await createToolDescription(
			listRuntimeFeatures(runtimeState),
			this.commands,
			featureContext,
			options,
		);

		const bash = await createBashTool(this.exec.bind(this), description, options);

		return {
			bash,
		};
	}
}

function syncCommands(x: X, runtimeState: FeatureRuntimeState): void {
	const nextCommands = listRuntimeCommands(runtimeState);
	x.commands.length = 0;
	x.commands.push(...nextCommands);
}

function resolveShellEnv(runtimeState: FeatureRuntimeState): Record<string, string> {
	return {
		...runtimeState.bashConfig.env,
		...resolveRuntimeFeatureEnv(runtimeState),
	};
}

export default X;
