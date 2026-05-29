import {
	Bash,
	type BashExecResult,
	type BashOptions,
	type Command,
	type ExecOptions,
	InMemoryFs,
	MountableFs,
} from "just-bash";
import { createGitFeature } from "@/features/git";
import { createMemoryFeature } from "@/features/memory";
import { createPatchFeature } from "@/features/patch";
import { createSkillsFeature, parseSkillInstallTarget } from "@/features/skills";
import { createWorkspaceFeature } from "@/features/workspace";
import { resolveBashConfig } from "@/runtime/config";
import { type EnvBackend, type EnvSnapshot, MemoryEnvBackend, mergeEnv } from "@/runtime/env";
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
	ExecHook,
	Feature,
	FeatureSetupContext,
	GetToolsOptions,
	XOptions,
} from "@/types";

export type {
	BashConfig,
	DefaultFeatureOptions,
	ExecHook,
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
export type { EnvBackend, EnvSnapshot } from "@/runtime/env";
export { KvEnvBackend, MemoryEnvBackend } from "@/runtime/env";
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
	readonly features: Feature[];
	readonly fs: MountableFs;
	private readonly envBackend: EnvBackend;
	private readonly execHooks: ExecHook[];
	private readonly hookEnv = new Map<string, string>();

	constructor(options: XOptions = {}) {
		const bashConfig = resolveBashConfig(options.bash);

		const sourceFs = options.fs ?? new InMemoryFs();
		const mountableFs = new MountableFs({ base: sourceFs });
		this.fs = mountableFs;
		this.commands = [];
		this.features = [];
		this.execHooks = [];

		const bashOptions: BashOptions = {
			...bashConfig,
			fs: mountableFs,
		};
		this.bash = new Bash(bashOptions);
		this.envBackend =
			options.envBackend ??
			new MemoryEnvBackend({
				cwd: bashConfig.cwd,
				env: bashConfig.env,
			});

		for (const hook of options.execHooks ?? []) {
			this.registerHook(hook);
		}
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
		const snapshot = (await this.envBackend.load()) ?? {
			cwd: this.bash.getCwd(),
			env: {},
		};
		const hookOptions = toHookOptions(options);
		const startSnapshot: EnvSnapshot = {
			cwd: snapshot.cwd,
			env: snapshot.env,
		};
		const featureContext = this.createFeatureContext();

		for (const hook of this.execHooks) {
			await hook.onExecStart?.({
				...featureContext,
				command,
				options: hookOptions,
				snapshot: startSnapshot,
			});
		}

		const shellEnv = this.resolveShellEnv();
		const baseEnv = options?.replaceEnv ? shellEnv : mergeEnv(shellEnv, snapshot.env);
		const execEnv = mergeEnv(baseEnv, options?.env);
		const execCwd = options?.cwd ?? snapshot.cwd ?? execEnv.PWD ?? this.bash.getCwd();
		const result = await this.bash.exec(command, {
			...options,
			cwd: execCwd,
			env: execEnv,
			replaceEnv: true,
		});

		const persistedEnv = mergeEnv(result.env);
		for (const key of Object.keys(shellEnv)) {
			delete persistedEnv[key];
		}
		const nextSnapshot: EnvSnapshot = {
			cwd: result.env.PWD ?? execCwd,
			env: persistedEnv,
		};

		await this.envBackend.save(nextSnapshot);
		for (const hook of this.execHooks) {
			await hook.onExecEnd?.({
				command,
				options: hookOptions,
				snapshot: nextSnapshot,
				result,
			});
		}
		return result;
	}

	registerCommand(command: Command): this {
		const registeredCommand =
			command.trusted === undefined
				? {
						...command,
						trusted: true,
					}
				: command;
		const existingIndex = this.commands.findIndex((item) => item.name === registeredCommand.name);
		if (existingIndex === -1) {
			this.commands.push(registeredCommand);
		} else {
			this.commands[existingIndex] = registeredCommand;
		}
		this.bash.registerCommand(registeredCommand);
		return this;
	}

	registerFeature(feature: Feature): this {
		this.features.push(feature);
		for (const command of feature.command ?? []) {
			this.registerCommand(command);
		}
		if (feature.hooks) {
			this.registerHook(feature.hooks);
		}
		return this;
	}

	registerHook(hook: ExecHook): this {
		this.execHooks.push(hook);
		return this;
	}

	async getTools(
		options: GetToolsOptions = {},
	): Promise<{ bash: Awaited<ReturnType<typeof createBashTool>> }> {
		const description = await createToolDescription(
			this.features,
			this.commands,
			this.createFeatureContext(),
			options,
		);

		const bash = await createBashTool(this.exec.bind(this), description, options);

		return {
			bash,
		};
	}

	private createFeatureContext(): FeatureSetupContext {
		return {
			bash: this.bash,
			fs: this.fs,
			setEnv: (key, value) => {
				this.hookEnv.set(key, value);
			},
		};
	}

	private resolveShellEnv(): Record<string, string> {
		return mergeEnv(this.bash.getEnv(), Object.fromEntries(this.hookEnv.entries()));
	}
}

function toHookOptions(options: ExecOptions | undefined) {
	return options
		? {
				cwd: options.cwd,
				env: options.env,
				replaceEnv: options.replaceEnv,
				stdin: options.stdin,
				stdinKind: options.stdinKind,
			}
		: undefined;
}

export default X;
