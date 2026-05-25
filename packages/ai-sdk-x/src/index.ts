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
import { setupMemoryFeature } from "@/features/memory";
import { setupPatchFeature } from "@/features/patch";
import { type FeatureSetupResult, initializeFeatureSetups } from "@/features/shared";
import { parseSkillInstallTarget, setupSkillsFeature } from "@/features/skills";
import { setupWorkspaceFeature } from "@/features/workspace";
import { resolveBashConfig } from "@/runtime/config";
import {
	createEnvironment,
	persistEnvironmentSnapshot,
	resolveEnvironmentSnapshot,
} from "@/runtime/environment";
import { MAX_OUTPUT } from "@/runtime/output";
import { createBashTool, createToolDescription } from "@/runtime/tools";

export { parseSkillInstallTarget };
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
	DefaultXCommands,
	Environment,
	GetToolsOptions,
	XCommandMap,
	XConfig,
	XOptions,
} from "@/types";

export type {
	BashConfig,
	DefaultXCommands,
	Environment,
	GetToolsOptions,
	KVStorage,
	MemoryConfig,
	MemoryOptions,
	PatchConfig,
	PatchOptions,
	SkillsConfig,
	SkillsOptions,
	WorkspaceConfig,
	WorkspaceOptions,
	XCommandMap,
	XConfig,
	XOptions,
} from "@/types";
export { MAX_OUTPUT };

export class X<TCommands extends XCommandMap = DefaultXCommands> {
	readonly bash: Bash;
	readonly config: XConfig;
	readonly fs: IFileSystem;
	readonly commands: TCommands;
	readonly env: Environment;

	constructor(options: XOptions = {}) {
		const bashConfig = resolveBashConfig(options.bash);
		this.env = createEnvironment(options.env);

		const baseFs = options.fs ?? new InMemoryFs();
		const mountableFs = new MountableFs({ base: baseFs });
		const featureContext = {
			baseFs,
			fs: mountableFs,
		};
		const workspaceFeature = setupWorkspaceFeature(featureContext, options.workspace);
		const skillsFeature = setupSkillsFeature(featureContext, options.skills);
		const memoryFeature = setupMemoryFeature(featureContext, options.memory);
		const patchFeature = setupPatchFeature(featureContext, options.patch);
		const featureResults = [
			workspaceFeature,
			skillsFeature,
			memoryFeature,
			patchFeature,
		] satisfies FeatureSetupResult[];

		this.config = {
			bash: {
				...bashConfig,
				env: {
					...bashConfig.env,
					...resolveFeatureHomeEnv({
						memory: memoryFeature.config,
						skills: skillsFeature.config,
						workspace: workspaceFeature.config,
					}),
				},
			},
			memory: memoryFeature.config,
			patch: patchFeature.config,
			skills: skillsFeature.config,
			workspace: workspaceFeature.config,
		};
		this.fs = mountableFs;

		const defaultCommands = {
			...(skillsFeature.command ? { skills: skillsFeature.command } : {}),
			...(memoryFeature.command ? { memory: memoryFeature.command } : {}),
			...(patchFeature.command ? { patch: patchFeature.command } : {}),
		} satisfies DefaultXCommands;
		this.commands = defaultCommands as unknown as TCommands;

		const bashOptions: BashOptions = {
			...this.config.bash,
			fs: mountableFs,
			customCommands: Object.values(this.commands).filter(
				(command): command is Command => command !== undefined,
			),
		};
		this.bash = new Bash(bashOptions);

		void initializeFeatureSetups(baseFs, featureResults);
	}

	async exec(command: string, options?: ExecOptions): Promise<BashExecResult> {
		const baseEnv = await resolveEnvironmentSnapshot(this.env, this.config.bash.env);
		const execEnv = options?.replaceEnv
			? { ...(options.env ?? {}), ...this.config.bash.env }
			: { ...baseEnv, ...(options?.env ?? {}) };
		const execCwd = options?.cwd ?? execEnv.PWD ?? this.config.bash.cwd;
		const result = await this.bash.exec(command, {
			...options,
			cwd: execCwd,
			env: execEnv,
			replaceEnv: true,
		});

		await persistEnvironmentSnapshot(this.env, this.config.bash.env, result.env);
		return result;
	}

	registerCommand<TName extends string, TCommand extends Command & { name: TName }>(
		command: TCommand,
	): X<TCommands & Record<TName, TCommand>> {
		(this.commands as XCommandMap)[command.name] = command;
		this.bash.registerCommand(command);
		return this as unknown as X<TCommands & Record<TName, TCommand>>;
	}

	async getTools(
		options: GetToolsOptions = {},
	): Promise<{ bash: Awaited<ReturnType<typeof createBashTool>> }> {
		return {
			bash: await createBashTool(
				this.exec.bind(this),
				createToolDescription(this.config, this.commands, options),
				options,
			),
		};
	}
}

function resolveFeatureHomeEnv(features: {
	memory: XConfig["memory"];
	skills: XConfig["skills"];
	workspace: XConfig["workspace"];
}): Record<string, string> {
	const env: Record<string, string> = {};

	if (features.memory.enabled) {
		env.MEMORY_HOME = features.memory.mountPoint;
	}

	if (features.skills.enabled) {
		env.SKILLS_HOME = features.skills.mountPoint;
	}

	if (features.workspace.enabled) {
		env.WORKSPACE_HOME = features.workspace.mountPoint;
	}

	return env;
}

export default X;
