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
import { DEFAULT_MEMORY_MOUNT, DEFAULT_SKILLS_MOUNT, DEFAULT_WORKSPACE_MOUNT } from "@/runtime/constants";
import { initializeMounts, mountIfEnabled } from "@/runtime/mounts";
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
	XOptions,
	XCommandMap,
	XConfig,
} from "@/types";

export type {
	BashConfig,
	DefaultXCommands,
	XOptions,
	KVStorage,
	MemoryConfig,
	MemoryOptions,
	SkillsConfig,
	SkillsOptions,
	WorkspaceConfig,
	WorkspaceOptions,
	XCommandMap,
	XConfig,
} from "@/types";

export class X<TCommands extends XCommandMap = DefaultXCommands> {
	readonly bash: Bash;
	readonly config: XConfig;
	readonly fs: IFileSystem;
	readonly commands: TCommands;

	constructor(options: XOptions = {}) {
		this.config = resolveConfig(options);

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
		return this.bash.exec(command, options);
	}

	registerCommand<TName extends string, TCommand extends Command & { name: TName }>(
		command: TCommand,
	): asserts this is X<TCommands & Record<TName, TCommand>> {
		(this.commands as XCommandMap)[command.name] = command;
		this.bash.registerCommand(command);
	}

	async getTools(): Promise<{ bash: Awaited<ReturnType<typeof createBashTool>> }> {
		return {
			bash: await createBashTool(this.bash, createToolDescription(this.config)),
		};
	}
}

export default X;
