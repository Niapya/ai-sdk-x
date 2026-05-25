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
import { createMemoryCommand } from "@/commands/memory";
import { createPatchCommand } from "@/commands/patch";
import { createSkillsCommand, parseSkillInstallTarget } from "@/commands/skills";
import { resolveConfig } from "@/runtime/config";
import {
	DEFAULT_MEMORY_MOUNT,
	DEFAULT_SKILLS_MOUNT,
	DEFAULT_WORKSPACE_MOUNT,
} from "@/runtime/constants";
import {
	createEnvironment,
	persistEnvironmentSnapshot,
	resolveEnvironmentSnapshot,
} from "@/runtime/environment";
import { initializeMounts, mountIfEnabled } from "@/runtime/mounts";
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
		this.config = resolveConfig(options);
		this.env = createEnvironment(options.env);

		const baseFs = options.fs ?? new InMemoryFs();
		const mountableFs = new MountableFs({ base: baseFs });
		const baseInitPaths = [
			mountIfEnabled(mountableFs, baseFs, this.config.workspace, DEFAULT_WORKSPACE_MOUNT),
			mountIfEnabled(mountableFs, baseFs, this.config.skills, DEFAULT_SKILLS_MOUNT),
			mountIfEnabled(mountableFs, baseFs, this.config.memory, DEFAULT_MEMORY_MOUNT),
		].filter((path): path is string => path !== undefined);
		this.fs = mountableFs;

		const defaultCommands = {
			skills: createSkillsCommand({
				cache: this.config.skills.cache,
				lockfile: this.config.skills.lockfile,
				mountPoint: this.config.skills.mountPoint,
			}),
			memory: createMemoryCommand({
				cache: this.config.memory.cache,
				mountPoint: this.config.memory.mountPoint,
			}),
			patch: createPatchCommand({
				mountPoint: this.config.workspace.mountPoint,
			}),
		} satisfies DefaultXCommands;
		this.commands = defaultCommands as unknown as TCommands;

		const bashOptions: BashOptions = {
			...this.config.bash,
			fs: mountableFs,
			customCommands: Object.values(this.commands) as Command[],
		};
		this.bash = new Bash(bashOptions);

		void initializeMounts(mountableFs, baseFs, baseInitPaths, this.config);
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

export default X;
