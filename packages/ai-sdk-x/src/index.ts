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
import { createSubpathFs } from "@/utils/subpath-fs";

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
	BashToolOptions,
	MemoryOptions,
	ResolvedEnvironmentOptions,
	SkillsOptions,
	WorkspaceOptions,
} from "@/types";

export type {
	BashToolOptions,
	KVStorage,
	MemoryOptions,
	SkillsOptions,
	WorkspaceOptions,
} from "@/types";

const DEFAULT_CWD = "/home/user";
const DEFAULT_WORKSPACE_MOUNT = "/home/user/workspace";
const DEFAULT_SKILLS_MOUNT = "/home/user/skills";
const DEFAULT_MEMORY_MOUNT = "/home/user/memory";

export class BashTool {
	readonly bash: Bash;
	readonly fs: IFileSystem;
	readonly memoryMount: string;
	readonly skillsMount: string;
	readonly workspaceMount: string;

	readonly commands: Record<string, Command> = {};

	constructor(options: BashToolOptions = {}) {
		const environment = resolveEnvironmentOptions(options);
		this.workspaceMount = environment.workspaceMount;
		this.skillsMount = environment.skillsMount;
		this.memoryMount = environment.memoryMount;

		const baseFs = options.fs ?? new InMemoryFs();
		const mountableFs = new MountableFs({ base: baseFs });
		const baseInitPaths = [
			mountIfEnabled(
				mountableFs,
				baseFs,
				options.workspace,
				this.workspaceMount,
				DEFAULT_WORKSPACE_MOUNT,
			),
			mountIfEnabled(mountableFs, baseFs, options.skills, this.skillsMount, DEFAULT_SKILLS_MOUNT),
			mountIfEnabled(mountableFs, baseFs, options.memory, this.memoryMount, DEFAULT_MEMORY_MOUNT),
		].filter((path): path is string => path !== undefined);
		this.fs = mountableFs;

		this.commands = {
			skills: createSkillsCommand({
				cache: typeof options.skills === "object" ? options.skills.cache : undefined,
				lockfile: environment.skillsLockfile,
				mountPoint: this.skillsMount,
			}),
			memory: createMemoryCommand({
				cache: typeof options.memory === "object" ? options.memory.cache : undefined,
				mountPoint: this.memoryMount,
			}),
			patch: createPatchCommand({
				mountPoint: this.workspaceMount,
			}),
		};

		const bashOptions: BashOptions = {
			cwd: options.bash?.cwd ?? DEFAULT_CWD,
			fs: mountableFs,
			customCommands: Object.values(this.commands),

			// Enable the JavaScript debugger by default
			javascript: true,
			python: true,

			// TODO
			env: { HOME: "/home/user" },

			...options.bash,
		};
		this.bash = new Bash(bashOptions);

		void this.initializeMounts(baseFs, baseInitPaths, environment.skillsLockfile);
	}

	async exec(command: string, options?: ExecOptions): Promise<BashExecResult> {
		return this.bash.exec(command, options);
	}

	registerCommand(command: Command): void {
		this.commands[command.name] = command;
		this.bash.registerCommand(command);
	}

	async getTools() {
		const { tool } = await import("ai");
		const { z } = await import("zod");
		if (!tool) {
			throw new Error("Failed to load 'ai' package.");
		}
		if (!z) {
			throw new Error("Failed to load 'zod' package.");
		}

		// 有可能会爆 context
		const bash = tool({
			description: this.createToolDescription(),
			inputSchema: z.object({
				command: z.string().describe("The bash command to execute."),
				cwd: z.string().optional().describe("Optional working directory for this command."),
				stdin: z.string().optional().describe("Optional stdin passed to the command."),
			}),
			execute: async ({ command, cwd, stdin }) => {
				const result = await this.bash.exec(command, {
					...(cwd !== undefined ? { cwd } : {}),
					...(stdin !== undefined ? { stdin } : {}),
				});

				return {
					stdout: result.stdout,
					stderr: result.stderr,
					exitCode: result.exitCode,
				};
			},
		});

		return {
			bash,
		};
	}

	private async initializeMounts(
		baseFs: IFileSystem,
		baseInitPaths: string[],
		lockfile: boolean,
	): Promise<void> {
		await Promise.all(baseInitPaths.map((path) => baseFs.mkdir(path, { recursive: true })));

		const lockfilePath = `${this.skillsMount}/skills.json`;
		if (lockfile && !(await this.fs.exists(lockfilePath))) {
			await this.fs.writeFile(
				lockfilePath,
				`${JSON.stringify({ version: 1, skills: {} }, null, 2)}\n`,
			);
		}
	}

	private createToolDescription(): string {
		return [
			"Execute bash commands in the AI SDK X virtual bash environment.",
			"",
			`WORKING DIRECTORY: ${DEFAULT_CWD}`,
			"All commands execute from this directory unless cwd is provided.",
			"",
			"Mounted directories:",
			`  ${this.workspaceMount} - persistent workspace files`,
			`  ${this.skillsMount} - installed skills and skills.json`,
			`  ${this.memoryMount} - MEMORY.md and daily memory files`,
			"",
			"Custom commands:",
			"  x-skills list",
			"  x-skills install <repo-url>@<skill-name>",
			"  x-memory list",
			"  x-memory add <title>",
			"  x-memory search <query>",
			"  x-patch [path]",
		].join("\n");
	}
}

export default BashTool;

function resolveEnvironmentOptions(options: BashToolOptions): ResolvedEnvironmentOptions {
	return {
		workspaceMount: optionMount(options.workspace, DEFAULT_WORKSPACE_MOUNT),
		skillsMount: optionMount(options.skills, DEFAULT_SKILLS_MOUNT),
		memoryMount: optionMount(options.memory, DEFAULT_MEMORY_MOUNT),
		skillsLockfile: typeof options.skills === "object" ? (options.skills.lockfile ?? true) : true,
	};
}

function optionMount(
	option: boolean | MemoryOptions | SkillsOptions | WorkspaceOptions | undefined,
	defaultMount: string,
): string {
	if (option === false) {
		return defaultMount;
	}
	if (typeof option === "object" && option.mountPoint) {
		return option.mountPoint;
	}
	return defaultMount;
}

function mountIfEnabled(
	fs: MountableFs,
	baseFs: IFileSystem,
	option: boolean | MemoryOptions | SkillsOptions | WorkspaceOptions | undefined,
	mountPoint: string,
	sourceRoot: string,
): string | undefined {
	if (option === false) {
		return undefined;
	}

	const mountedFs = typeof option === "object" ? option.fs : undefined;
	if (mountedFs) {
		fs.mount(mountPoint, mountedFs);
		return undefined;
	}

	if (mountPoint !== sourceRoot) {
		fs.mount(mountPoint, createSubpathFs(baseFs, sourceRoot));
	}

	return sourceRoot;
}
