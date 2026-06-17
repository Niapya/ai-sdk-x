import {
	Bash,
	type BashExecResult,
	type BashOptions,
	type Command,
	type ExecOptions,
	InMemoryFs,
} from "just-bash";
import { createGitFeature, createGitFeatureDescription } from "@/features/git";
import {
	createMemoryCommand,
	createMemoryFeature,
	createMemoryFeatureDescription,
} from "@/features/memory";
import {
	createPatchCommand,
	createPatchFeature,
	createPatchFeatureDescription,
} from "@/features/patch";
import {
	createSkillsCommand,
	createSkillsFeature,
	createSkillsFeatureDescription,
	parseSkillInstallTarget,
} from "@/features/skills";
import { createWorkspaceFeature, createWorkspaceFeatureDescription } from "@/features/workspace";
import { resolveBashConfig } from "@/runtime/config";
import { type EnvBackend, type EnvSnapshot, MemoryEnvBackend, mergeEnv } from "@/runtime/env";
import { BootstrappableMountableFs } from "@/runtime/fs";
import { MAX_OUTPUT } from "@/runtime/output";
import { createBashTool } from "@/runtime/tools";
import type { Instructions } from "@/types/options";

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
		const instructions = await this.getInstructions(options);
		const description =
			options.enableDescription === false
				? instructions.environment
				: [instructions.guidance, instructions.environment].filter(Boolean).join("\n\n");

		const bash = await createBashTool(this.exec.bind(this), description, options);

		return {
			bash,
		};
	}

	async getInstructions(options: GetToolsOptions = {}): Promise<Instructions> {
		const featureContext = this.createFeatureContext();
		const networkEnabled = Boolean(this.bashConfig.fetch || this.bashConfig.network);
		const javascriptEnabled = Boolean(this.bashConfig.javascript);
		const pythonEnabled = Boolean(this.bashConfig.python);

		const featureInstructions = await Promise.all(
			this.features.map(async (feature) => {
				const description = await feature.description?.(featureContext);
				if (!description) {
					return {
						guidance: "",
						environment: "",
					};
				}

				const instructions =
					typeof description === "string"
						? { guidance: "", environment: description }
						: {
								guidance: description.guidance ?? "",
								environment: description.environment ?? "",
							};

				return {
					guidance: instructions.guidance
						? [
								`<feature:${feature.name}>`,
								instructions.guidance,
								`</feature:${feature.name}>`,
							].join("\n")
						: "",
					environment: instructions.environment
						? [
								`<feature:${feature.name}>`,
								instructions.environment,
								`</feature:${feature.name}>`,
							].join("\n")
						: "",
				};
			}),
		);

		const featureGuidance = featureInstructions
			.map((instructions) => instructions.guidance)
			.filter(Boolean)
			.join("\n\n");
		const featureEnvironment = featureInstructions
			.map((instructions) => instructions.environment)
			.filter(Boolean)
			.join("\n\n");

		const guidance = [
			"<bash_tool_guidance>",
			"<usage>",
			"This guidance applies to the Bash tool.",
			"The feature entries below describe shell commands and mounted paths available inside Bash. They are NOT separate tools or function calls.",
			"Put shell syntax in the Bash tool's `command` argument. Use `cwd` instead of `cd` when changing directories for a command.",
			"Use `stdin` only for raw input to commands that read stdin; do not put shell code in `stdin`.",
			"If unsure, run `help`, `<command> --help`, or `<command> <subcommand> --help`.",
			"</usage>",

			"<large_files>",
			"Use targeted inspection for large files and large repositories instead of dumping whole files.",
			"Examples: `rg --files`, `rg -n \"pattern\" <path>`, `grep -n \"pattern\" <file>`, `sed -n '120,180p' <file>`, `nl -ba <file> | sed -n '120,180p'`, `wc -l <file>`.",
			"Use structured tools when appropriate: `jq` for JSON, `yq` for YAML/TOML/XML/CSV, `sqlite3` for SQLite, and `awk`, `sort`, `uniq`, `cut`, `xargs` for text pipelines.",
			"</large_files>",

			featureGuidance ? ["<features>", featureGuidance, "</features>"].join("\n") : "",
			"</bash_tool_guidance>",
		]
			.filter(Boolean)
			.join("\n");

		const environment = [
			"<bash_tool_environment>",
			"<environment>",
			"Bash tool is a virtual bash shell for running Unix-style commands and scripts inside a sandboxed environment.",
			`initial cwd: ${featureContext.bash.getCwd()}`,
			"</environment>",

			networkEnabled
				? [
						"<network>",
						"Network is on. Use `curl` to fetch URLs, and pipe HTML through `html-to-markdown` when Markdown is easier to inspect.",
						"Example: `curl https://react.dev/reference | html-to-markdown`.",
						"</network>",
					].join("\n")
				: "",

			javascriptEnabled
				? [
						"<javascript>",
						"You may use `js-exec` (Supported By WASM) INSTEAD of `node` for JavaScript or TypeScript processing.",
						"When importing local code, prefer `.mjs` or `.mts` modules. Imports may reference enabled mounts such as workspace or skills.",
						"</javascript>",
					].join("\n")
				: "",

			pythonEnabled
				? [
						"<python>",
						"You may use `python3` or `python` (Supported By WASM) for Python scripts and data processing when that is the most direct tool.",
						"</python>",
					].join("\n")
				: "",

			"<features>",
			featureEnvironment,
			"</features>",

			options.externalDescription ?? "",
			"</bash_tool_environment>",
		]
			.filter(Boolean)
			.join("\n");

		return {
			guidance,
			environment,
		};
	}

	/**
	 * @deprecated Use `getInstructions()` instead.
	 */
	async createToolDescription(options: GetToolsOptions = {}): Promise<string> {
		const instructions = await this.getInstructions(options);
		return [instructions.guidance, instructions.environment].filter(Boolean).join("\n\n");
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

export type { MemoryFeature } from "@/features/memory";
export type { SkillsFeature } from "@/features/skills";
export type {
	BooleanFlagDefinition,
	CliCommandDefinition,
	CliDefinition,
	CliTopicDefinition,
	CommandArgDefinition,
	CommandExample,
	CommandFlagDefinition,
	CommandInput,
	HelpInfo,
	MultipleValueArgDefinition,
	MultipleValueFlagDefinition,
	SingleValueArgDefinition,
	SingleValueFlagDefinition,
	StringFlagDefinition,
} from "@/utils";
export {
	commandError,
	commandUsageError,
	createCommand,
	defineCliCommand,
	defineCliTopic,
	hasHelpFlag,
	showHelp,
} from "@/utils";
export {
	createGitFeature,
	createGitFeatureDescription,
	createMemoryCommand,
	createMemoryFeature,
	createMemoryFeatureDescription,
	createPatchCommand,
	createPatchFeature,
	createPatchFeatureDescription,
	createSkillsCommand,
	createSkillsFeature,
	createSkillsFeatureDescription,
	createWorkspaceFeature,
	createWorkspaceFeatureDescription,
	parseSkillInstallTarget,
};

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
	BashExecResult,
	BashOptions,
	BufferEncoding,
	Command,
	CommandContext,
	CpOptions,
	DirectoryEntry,
	ExecOptions,
	ExecResult,
	FileContent,
	FileEntry,
	FileInit,
	FileSystemFactory,
	FsEntry,
	FsStat,
	IFileSystem,
	InitialFiles,
	LazyFileEntry,
	LazyFileProvider,
	MkdirOptions,
	MountableFsOptions,
	MountConfig,
	OutputKind,
	ReadWriteFsOptions,
	RmOptions,
	SymlinkEntry,
} from "just-bash";
export {
	Bash,
	bytesOutput,
	decodeBytesToUtf8,
	EMPTY_BYTES,
	encodeUtf8ToBytes,
	InMemoryFs,
	latin1FromBytes,
	MountableFs,
	OverlayFs,
	ReadWriteFs,
	stdoutAsBytes,
	stdoutKind,
	textOutput,
	unsafeBytesFromLatin1,
} from "just-bash";
export { AsyncOnce } from "@/runtime/async-once";
export type { EnvBackend, EnvSnapshot } from "@/runtime/env";
export {
	cloneEnv,
	createNullProtoEnv,
	KvEnvBackend,
	MemoryEnvBackend,
	mergeEnv,
} from "@/runtime/env";
export type {
	CachingFsOptions,
	IndexedFsOptions,
	TransactionalFsOptions,
	TransactionalFsStatus,
} from "@/runtime/fs";
export {
	BootstrappableMountableFs,
	CachingFs,
	createSubpathFs,
	IndexedFs,
	TransactionalFs,
} from "@/runtime/fs";
export type { InMemoryKVStoreOptions } from "@/runtime/storage";
export { InMemoryKVStore } from "@/runtime/storage";
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
export type { FsDirent } from "@/utils";
export { MAX_OUTPUT };
