import {
	Bash,
	type BashExecResult,
	type BashOptions,
	type Command,
	type ExecOptions,
	InMemoryFs,
} from "just-bash";
import { createGitFeature } from "@/features/git";
import { createMemoryFeature } from "@/features/memory";
import { createPatchFeature } from "@/features/patch";
import { createSkillsFeature, parseSkillInstallTarget } from "@/features/skills";
import { createWorkspaceFeature } from "@/features/workspace";
import { resolveBashConfig } from "@/runtime/config";
import { type EnvBackend, type EnvSnapshot, MemoryEnvBackend, mergeEnv } from "@/runtime/env";
import { BootstrappableMountableFs } from "@/runtime/fs";
import { MAX_OUTPUT } from "@/runtime/output";
import { createBashTool } from "@/runtime/tools";

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
	BashConfig,
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
	FeatureSetupContext,
	GetToolsOptions,
	GitConfig,
	GitOptions,
	KVStorage,
	MemoryConfig,
	MemoryOptions,
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
	BootstrappableMountableFs,
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
	readonly fs: BootstrappableMountableFs;
	private readonly bashConfig: BashConfig;
	private readonly envBackend: EnvBackend;
	private readonly execHooks: ExecHook[];
	private readonly featureEnv = new Map<string, string>();

	constructor(options: XOptions = {}) {
		const bashConfig = resolveBashConfig(options.bash);
		this.bashConfig = bashConfig;
		const { cwd, network, ...bashOptionsBase } = bashConfig;

		const sourceFs = options.fs ?? new InMemoryFs();
		const mountableFs = new BootstrappableMountableFs({ base: sourceFs });
		this.fs = mountableFs;
		this.commands = [];
		this.features = [];
		this.execHooks = [];

		const bashOptions: BashOptions = {
			...bashOptionsBase,
			...(options.bash?.cwd === undefined ? {} : { cwd }),
			...(network === false ? {} : { network }),
			fs: mountableFs,
		};
		this.bash = new Bash(bashOptions);
		this.envBackend =
			options.envBackend ??
			new MemoryEnvBackend({
				cwd: this.bash.getCwd(),
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

		x.registerFeature(createPatchFeature(patch));
		x.registerFeature(createGitFeature(git));
		x.registerFeature(createWorkspaceFeature(workspace));
		x.registerFeature(createSkillsFeature(skills));
		x.registerFeature(createMemoryFeature(memory));

		return x;
	}

	async exec(command: string, options?: ExecOptions): Promise<BashExecResult> {
		const snapshot = (await this.envBackend.load()) ?? {
			cwd: this.bash.getCwd(),
			env: {},
		};
		const hookOptions = options
			? {
					cwd: options.cwd,
					env: options.env,
					replaceEnv: options.replaceEnv,
					stdin: options.stdin,
					stdinKind: options.stdinKind,
				}
			: undefined;
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

		const featureEnv = mergeEnv(Object.fromEntries(this.featureEnv.entries()));
		const baseEnv = options?.replaceEnv
			? featureEnv
			: mergeEnv(this.bash.getEnv(), snapshot.env, featureEnv);
		const execEnv = mergeEnv(baseEnv, options?.env);
		const execCwd = options?.cwd ?? snapshot.cwd ?? execEnv.PWD ?? this.bash.getCwd();
		const result = await this.bash.exec(command, {
			...options,
			cwd: execCwd,
			env: execEnv,
			replaceEnv: true,
		});

		const persistsEnv = !options?.env && !options?.replaceEnv;
		const persistedEnv = mergeEnv(persistsEnv ? result.env : snapshot.env);
		for (const key of Object.keys(featureEnv)) {
			delete persistedEnv[key];
		}
		const nextSnapshot: EnvSnapshot = {
			cwd: options?.cwd ? snapshot.cwd : (result.env.PWD ?? execCwd),
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
		const description = await this.createToolDescription(options);

		const bash = await createBashTool(this.exec.bind(this), description, options);

		return {
			bash,
		};
	}

	async createToolDescription(options: GetToolsOptions = {}): Promise<string> {
		const featureContext = this.createFeatureContext();
		const networkEnabled = Boolean(this.bashConfig.fetch || this.bashConfig.network);
		const javascriptEnabled = Boolean(this.bashConfig.javascript);
		const pythonEnabled = Boolean(this.bashConfig.python);

		const featureDescriptions = (
			await Promise.all(
				this.features.map(async (feature) => {
					const description = await feature.description?.(featureContext);
					if (!description) return "";

					return [
						"<feature>",
						`<title>${feature.name}</title>`,
						`<description>${description}</description>`,
						"</feature>",
					].join("\n");
				}),
			)
		).join("\n\n");

		const sections = [
			// Environment
			"Bash tool is a virtual bash shell for running Unix-style commands and scripts inside a sandboxed environment.",
			`Current cwd: ${featureContext.bash.getCwd()}`,
			`Network: ${networkEnabled ? "on" : "off"}`,

			// Tool contract
			'`command` is required and must contain the shell command to run. Example: { command: "echo hello" }.',
			"`cwd` is optional and sets the working directory for that command. Use it instead of `cd ... && ...`.",
			'`stdin` is optional raw stdin text for commands that read stdin. Example: { command: "cat", stdin: "hello\\n" }.',
			"Do not put shell code in `stdin`; put it in `command`.",

			// Command usage tips
			"Use targeted commands for large files and large repositories. Prefer `rg --files` to discover files, `rg -n \"pattern\" <path>` to search with line numbers, `sed -n '120,180p' <path>` to read a specific range, and `nl -ba <path> | sed -n '120,180p'` when numbered output is needed.",
			"Use `wc -l`, `file`, `du`, `head`, and `tail` to understand file size and shape before reading. Avoid dumping very large files with plain `cat`.",
			"Use structured data tools when appropriate: `jq` for JSON, `yq` for YAML/TOML/XML/CSV, `sqlite3` for SQLite, and pipelines with `awk`, `sort`, `uniq`, `cut`, and `xargs` for text processing.",
			"If you are unsure how a command works, run `<command> --help` or `help <command>`.",

			networkEnabled
				? "Network is on, you may use `curl` to fetch URLs. `html-to-markdown` is available for converting fetched HTML into Markdown, for example: `curl https://github.blog | html-to-markdown`."
				: "",

			javascriptEnabled
				? "You may use `js-exec` for JavaScript or TypeScript processing. When importing local code, prefer `.mjs` or `.mts` modules. Imports may reference files from enabled feature mounts such as workspace or skills."
				: "",

			pythonEnabled
				? "You may use `python3` or `python` for Python scripts and data processing when that is the most direct tool."
				: "",

			"Entries under Available features describe shell commands or mounted paths available inside this bash environment. They are NOT callable tools.",
			"Available features:",
			`<features>${featureDescriptions}</features>`,

			options.description ?? "",
		]
			.filter(Boolean)
			.join("\n");

		return sections;
	}

	private createFeatureContext(): FeatureSetupContext {
		return {
			bash: this.bash,
			fs: this.fs,
			setEnv: (key, value) => {
				this.featureEnv.set(key, value);
			},
		};
	}
}

export default X;
