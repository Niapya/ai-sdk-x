import { type Command, type CommandContext, defineCommand, type ExecResult } from "just-bash";

/**
 * Creates a shell-like command error result with stderr output and a non-zero exit code.
 */
export function commandError(stderr: string, exitCode: number): ExecResult {
	return { stdout: "", stderr, exitCode };
}

/**
 * Describes a help document rendered by {@link showHelp}.
 */
export interface HelpInfo {
	name: string;
	trusted?: boolean;
	summary?: string;
	usage?: string;
	description?: string | string[];
	options?: string[];
	examples?: string[];
	notes?: string[];
}

/**
 * Describes a single example shown in rendered help output.
 */
export interface CommandExample {
	command: string;
	description?: string;
}

interface BaseArgDefinition {
	default?: string | string[];
	defaultHelp?: string;
	description?: string;
	hidden?: boolean;
	name: string;
	options?: string[];
	required?: boolean;
	summary?: string;
}

/**
 * Declares a single positional argument accepted by a CLI command.
 */
export interface SingleValueArgDefinition<_Name extends string = string>
	extends Omit<BaseArgDefinition, "default" | "multiple"> {
	default?: string;
	multiple?: false;
}

/**
 * Declares a variadic positional argument accepted by a CLI command.
 */
export interface MultipleValueArgDefinition<_Name extends string = string>
	extends Omit<BaseArgDefinition, "default"> {
	default?: string[];
	multiple: true;
}

/**
 * Declares a positional argument accepted by a CLI command.
 */
export type CommandArgDefinition<Name extends string = string> =
	| SingleValueArgDefinition<Name>
	| MultipleValueArgDefinition<Name>;

interface BaseFlagDefinition {
	aliases?: string[];
	char?: string;
	defaultHelp?: string;
	description?: string;
	helpLabel?: string;
	hidden?: boolean;
	required?: boolean;
	summary?: string;
}

/**
 * Declares a boolean flag accepted by a CLI command.
 */
export interface BooleanFlagDefinition extends BaseFlagDefinition {
	allowNo?: boolean;
	default?: boolean;
	type: "boolean";
}

/**
 * Declares a single-value string flag accepted by a CLI command.
 */
export interface SingleValueFlagDefinition extends BaseFlagDefinition {
	default?: string;
	helpValue?: string;
	multiple?: false;
	options?: string[];
	type: "string";
}

/**
 * Declares a multi-value string flag accepted by a CLI command.
 */
export interface MultipleValueFlagDefinition extends BaseFlagDefinition {
	default?: string[];
	helpValue?: string;
	multiple: true;
	options?: string[];
	type: "string";
}

/**
 * Declares a string flag accepted by a CLI command.
 */
export type StringFlagDefinition = SingleValueFlagDefinition | MultipleValueFlagDefinition;

/**
 * Declares any supported flag accepted by a CLI command.
 */
export type CommandFlagDefinition = BooleanFlagDefinition | StringFlagDefinition;

interface BaseCommandDefinition {
	allowDashPositionals?: boolean;
	aliases?: string[];
	description?: string | string[];
	examples?: Array<CommandExample | string>;
	hidden?: boolean;
	id: string;
	strict?: boolean;
	summary?: string;
	trusted?: boolean;
	usage?: string;
}

type CommandArgDefinitions = readonly CommandArgDefinition[];
type CommandFlagDefinitions = Readonly<Record<string, CommandFlagDefinition>>;

type ResolvedArgValue<Definition extends CommandArgDefinition> = Definition extends {
	multiple: true;
}
	? Definition extends { required: true }
		? string[]
		: Definition extends { default: string[] }
			? string[]
			: string[] | undefined
	: Definition extends { required: true }
		? string
		: Definition extends { default: string }
			? string
			: string | undefined;

type ResolvedFlagValue<Definition extends CommandFlagDefinition> = Definition extends {
	type: "boolean";
}
	? Definition extends { required: true }
		? boolean
		: Definition extends { default: boolean }
			? boolean
			: boolean | undefined
	: Definition extends { multiple: true }
		? Definition extends { required: true }
			? string[]
			: Definition extends { default: string[] }
				? string[]
				: string[] | undefined
		: Definition extends { required: true }
			? string
			: Definition extends { default: string }
				? string
				: string | undefined;

type ResolvedCommandArgs<Definitions extends CommandArgDefinitions | undefined> =
	Definitions extends readonly CommandArgDefinition[]
		? {
				[Definition in Definitions[number] as Definition["name"]]: ResolvedArgValue<Definition>;
			}
		: Record<string, never>;

type ResolvedCommandFlags<Definitions extends CommandFlagDefinitions | undefined> =
	Definitions extends Readonly<Record<string, CommandFlagDefinition>>
		? {
				[Name in keyof Definitions]: ResolvedFlagValue<Definitions[Name]>;
			}
		: Record<string, never>;

/**
 * Contains the parsed argv, positional args, and flags passed to a command handler.
 */
export type CommandInput<
	Args extends CommandArgDefinitions | undefined = undefined,
	Flags extends CommandFlagDefinitions | undefined = undefined,
> = {
	args: ResolvedCommandArgs<Args>;
	argv: string[];
	flags: ResolvedCommandFlags<Flags>;
};

/**
 * Declares a leaf CLI command handled by {@link createCommand}.
 */
export interface CliCommandDefinition<
	Args extends CommandArgDefinitions | undefined = undefined,
	Flags extends CommandFlagDefinitions | undefined = undefined,
> extends BaseCommandDefinition {
	args?: Args;
	flags?: Flags;
	/**
	 * Executes the command with parsed positional args and flags.
	 */
	run(input: CommandInput<Args, Flags>, ctx: CommandContext): ExecResult | Promise<ExecResult>;
	type: "command";
}

/**
 * Declares a CLI topic that routes to nested subcommands.
 */
export interface CliTopicDefinition<
	Subcommands extends readonly CliDefinition[] = readonly CliDefinition[],
> extends BaseCommandDefinition {
	subcommands: Subcommands;
	type: "topic";
}

type AnyCliCommandDefinition = CliCommandDefinition<CommandArgDefinitions, CommandFlagDefinitions>;
type AnyCliTopicDefinition = CliTopicDefinition;

/**
 * Declares either a CLI topic or a leaf CLI command.
 */
export type CliDefinition = AnyCliCommandDefinition | AnyCliTopicDefinition;

/**
 * Preserves argument and flag inference for a leaf CLI command definition.
 */
export function defineCliCommand<
	const Args extends CommandArgDefinitions | undefined = undefined,
	const Flags extends CommandFlagDefinitions | undefined = undefined,
>(definition: CliCommandDefinition<Args, Flags>): CliCommandDefinition<Args, Flags> {
	return definition;
}

/**
 * Preserves nested subcommand types for a CLI topic definition.
 */
export function defineCliTopic<const Subcommands extends readonly CliDefinition[]>(
	definition: CliTopicDefinition<Subcommands>,
): CliTopicDefinition<Subcommands> {
	return definition;
}

/**
 * Returns true when `argv` contains a help flag before the `--` delimiter.
 */
export function hasHelpFlag(args: string[]): boolean {
	for (const arg of args) {
		if (arg === "--") {
			return false;
		}

		if (arg === "--help" || arg === "-h") {
			return true;
		}
	}

	return false;
}

/**
 * Renders a standalone help document.
 */
export function showHelp(info: HelpInfo): ExecResult {
	let output = info.summary ? `${info.name} - ${info.summary}\n` : `${info.name}\n`;
	if (info.usage) {
		output += `\nUsage: ${info.usage}\n`;
	}
	if (info.description) {
		output += "\nDescription:\n";
		if (typeof info.description === "string") {
			for (const line of info.description.split("\n")) {
				output += line ? `  ${line}\n` : "\n";
			}
		} else if (info.description.length > 0) {
			for (const line of info.description) {
				output += line ? `  ${line}\n` : "\n";
			}
		}
	}
	if (info.options && info.options.length > 0) {
		output += "\nOptions:\n";
		for (const opt of info.options) {
			output += `  ${opt}\n`;
		}
	}
	if (info.examples && info.examples.length > 0) {
		output += "\nExamples:\n";
		for (const example of info.examples) {
			output += `  ${example}\n`;
		}
	}
	if (info.notes && info.notes.length > 0) {
		output += "\nNotes:\n";
		for (const note of info.notes) {
			output += `  ${note}\n`;
		}
	}
	return { stdout: output, stderr: "", exitCode: 0 };
}

/**
 * Compiles a CLI topic or command definition into a just-bash command.
 */
export function createCommand(definition: CliDefinition): Command {
	const command = defineCommand(definition.id, async (argv, ctx) => {
		return runDefinition(definition, argv, ctx, [definition.id]);
	});

	if (definition.trusted !== undefined) {
		return { ...command, trusted: definition.trusted };
	}

	return command;
}

function findSubcommand(
	definition: AnyCliTopicDefinition,
	name: string,
): CliDefinition | undefined {
	for (const subcommand of definition.subcommands) {
		if (subcommand.id === name || subcommand.aliases?.includes(name)) {
			return subcommand;
		}
	}

	return undefined;
}

async function runDefinition(
	definition: CliDefinition,
	argv: string[],
	ctx: CommandContext,
	path: string[],
): Promise<ExecResult> {
	if (definition.type === "topic") {
		const [subcommandName, ...rest] = argv;
		if (!subcommandName) {
			return topicHelp(definition, path);
		}

		const subcommand = findSubcommand(definition, subcommandName);
		if (subcommand) {
			return runDefinition(subcommand, rest, ctx, [...path, subcommand.id]);
		}

		if (hasHelpFlag(argv)) {
			return topicHelp(definition, path);
		}

		return topicUsageError(
			definition,
			path,
			`${path.join(" ")}: unknown command: ${subcommandName}\n`,
		);
	}

	if (hasHelpFlag(argv)) {
		return commandHelp(definition, path);
	}

	const parsed = parseCommandInput(definition, argv);
	if ("error" in parsed) {
		return commandUsageError(definition, path, parsed.error);
	}

	return definition.run(parsed, ctx);
}

function parseCommandInput<
	Args extends CommandArgDefinitions | undefined,
	Flags extends CommandFlagDefinitions | undefined,
>(
	definition: CliCommandDefinition<Args, Flags>,
	argv: string[],
): CommandInput<Args, Flags> | { error: string } {
	const flagDefinitions = (definition.flags ?? {}) as Record<string, CommandFlagDefinition>;
	const aliasToName = new Map<string, string>();
	const argDefinitionError = validateArgDefinitions(definition.args ?? []);
	if (argDefinitionError) {
		return { error: argDefinitionError };
	}

	for (const [name, flag] of Object.entries(flagDefinitions)) {
		if (flag.char) {
			aliasToName.set(flag.char, name);
		}
		for (const alias of flag.aliases ?? []) {
			aliasToName.set(alias, name);
		}
	}

	const flags: Record<string, boolean | string | string[] | undefined> = {};
	const positionals: string[] = [];

	for (let index = 0; index < argv.length; index++) {
		const token = argv[index];
		if (token === "--") {
			positionals.push(...argv.slice(index + 1));
			break;
		}

		if (definition.allowDashPositionals && shouldCaptureAsPositional(definition, positionals)) {
			positionals.push(token);
			continue;
		}

		if (token.startsWith("--no-")) {
			const name = token.slice(5);
			const flag = flagDefinitions[name];
			if (flag?.type !== "boolean" || !flag.allowNo) {
				return { error: `Nonexistent flag: --no-${name}\n` };
			}

			flags[name] = false;
			continue;
		}

		if (token.startsWith("--")) {
			const body = token.slice(2);
			const equalsIndex = body.indexOf("=");
			const name = equalsIndex >= 0 ? body.slice(0, equalsIndex) : body;
			const flag = flagDefinitions[name];
			if (!flag) {
				return { error: `Nonexistent flag: --${name}\n` };
			}

			if (flag.type === "boolean") {
				if (equalsIndex >= 0) {
					return { error: `Unexpected value for boolean flag: --${name}\n` };
				}
				flags[name] = true;
				continue;
			}

			let value = equalsIndex >= 0 ? body.slice(equalsIndex + 1) : undefined;
			if (value === undefined) {
				index += 1;
				value = argv[index];
			}
			if (value === undefined || looksLikeFlagToken(value)) {
				return { error: `Missing value for flag: --${name}\n` };
			}

			if (flag.options && !flag.options.includes(value)) {
				return { error: `Expected --${name} to be one of: ${flag.options.join(", ")}\n` };
			}

			if (flag.multiple) {
				const current = flags[name];
				flags[name] = Array.isArray(current) ? [...current, value] : [value];
			} else {
				flags[name] = value;
			}
			continue;
		}

		if (token.startsWith("-") && token !== "-") {
			if (token.length !== 2) {
				return { error: `Unsupported flag syntax: ${token}\n` };
			}

			const alias = token.slice(1);
			const name = aliasToName.get(alias);
			if (!name) {
				return { error: `Nonexistent flag: ${token}\n` };
			}

			const flag = flagDefinitions[name];
			if (!flag) {
				return { error: `Nonexistent flag: ${token}\n` };
			}

			if (flag.type === "boolean") {
				flags[name] = true;
				continue;
			}

			index += 1;
			const value = argv[index];
			if (value === undefined || looksLikeFlagToken(value)) {
				return { error: `Missing value for flag: ${token}\n` };
			}

			if (flag.options && !flag.options.includes(value)) {
				return { error: `Expected ${token} to be one of: ${flag.options.join(", ")}\n` };
			}

			if (flag.multiple) {
				const current = flags[name];
				flags[name] = Array.isArray(current) ? [...current, value] : [value];
			} else {
				flags[name] = value;
			}
			continue;
		}

		positionals.push(token);
	}

	for (const [name, flag] of Object.entries(flagDefinitions)) {
		if (flags[name] === undefined && flag.default !== undefined) {
			flags[name] = flag.default;
		}
		if (flag.required && flags[name] === undefined) {
			return { error: `Missing required flag: --${name}\n` };
		}
	}

	const args: Record<string, string | string[] | undefined> = {};
	const definitions = definition.args ?? [];
	let offset = 0;

	for (let index = 0; index < definitions.length; index++) {
		const arg = definitions[index];
		if (arg.multiple) {
			const values = positionals.slice(offset);
			if (values.length === 0) {
				if (arg.default !== undefined) {
					args[arg.name] = arg.default;
				} else if (arg.required) {
					return { error: `Missing required arg: ${arg.name}\n` };
				}
			} else {
				if (arg.options && values.some((value) => !arg.options?.includes(value))) {
					return { error: `Expected ${arg.name} to be one of: ${arg.options.join(", ")}\n` };
				}
				args[arg.name] = values;
			}
			offset = positionals.length;
			continue;
		}

		const value = positionals[offset];
		if (value === undefined) {
			if (arg.default !== undefined) {
				args[arg.name] = arg.default;
			} else if (arg.required) {
				return { error: `Missing required arg: ${arg.name}\n` };
			}
			continue;
		}

		if (arg.options && !arg.options.includes(value)) {
			return { error: `Expected ${arg.name} to be one of: ${arg.options.join(", ")}\n` };
		}

		args[arg.name] = value;
		offset += 1;
	}

	if ((definition.strict ?? true) && offset < positionals.length) {
		return { error: `Unexpected arg: ${positionals[offset]}\n` };
	}

	return {
		args: args as ResolvedCommandArgs<Args>,
		argv,
		flags: flags as ResolvedCommandFlags<Flags>,
	};
}

function validateArgDefinitions(definitions: CommandArgDefinitions): string | undefined {
	const variadicIndex = definitions.findIndex((arg) => arg.multiple);
	if (variadicIndex >= 0 && variadicIndex < definitions.length - 1) {
		return `Variadic arg must be the final arg: ${definitions[variadicIndex].name}\n`;
	}

	return undefined;
}

function shouldCaptureAsPositional(
	definition: { args?: CommandArgDefinitions },
	positionals: string[],
): boolean {
	const args = definition.args ?? [];
	const variadicIndex = args.findIndex((arg) => arg.multiple);
	return variadicIndex >= 0 && positionals.length > variadicIndex;
}

function looksLikeFlagToken(value: string): boolean {
	return value !== "-" && value.startsWith("-");
}

function commandHelp(definition: AnyCliCommandDefinition, path: string[]): ExecResult {
	const lines: string[] = [];
	if (definition.summary) {
		lines.push(`${path.join(" ")} - ${definition.summary}`);
		lines.push("");
	}

	lines.push(`Usage: ${definition.usage ?? buildCommandUsage(definition, path)}`);

	if (definition.description) {
		lines.push("");
		lines.push("Description:");
		lines.push(...formatIndentedLines(definition.description));
	}

	const args = ((definition.args ?? []) as readonly CommandArgDefinition[]).filter(
		(arg) => !arg.hidden,
	);
	if (args.length > 0) {
		lines.push("");
		lines.push("Arguments:");
		for (const arg of args) {
			const required = arg.required ? " (required)" : "";
			const multiple = arg.multiple ? "..." : "";
			const summary = arg.summary ?? arg.description ?? "";
			lines.push(`  ${arg.name}${multiple}${required}${summary ? ` - ${summary}` : ""}`);
		}
	}

	const flags = Object.entries(
		(definition.flags ?? {}) as Record<string, CommandFlagDefinition>,
	).filter(([, flag]) => !flag.hidden);
	if (flags.length > 0) {
		lines.push("");
		lines.push("Flags:");
		for (const [name, flag] of flags) {
			lines.push(`  ${formatFlagLabel(name, flag)}${formatFlagSummary(flag)}`);
		}
	}

	const examples = definition.examples ?? [];
	if (examples.length > 0) {
		lines.push("");
		lines.push("Examples:");
		for (const example of examples) {
			if (typeof example === "string") {
				lines.push(`  ${example}`);
				continue;
			}
			if (example.description) {
				lines.push(`  ${example.description}`);
			}
			lines.push(`  ${example.command}`);
		}
	}

	return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}

function topicHelp(definition: AnyCliTopicDefinition, path: string[]): ExecResult {
	const lines: string[] = [];
	if (definition.summary) {
		lines.push(`${path.join(" ")} - ${definition.summary}`);
		lines.push("");
	}

	lines.push(`Usage: ${definition.usage ?? `${path.join(" ")} <command>`}`);

	if (definition.description) {
		lines.push("");
		lines.push("Description:");
		lines.push(...formatIndentedLines(definition.description));
	}

	const subcommands = definition.subcommands.filter((subcommand) => !subcommand.hidden);
	if (subcommands.length > 0) {
		lines.push("");
		lines.push("Commands:");
		for (const subcommand of subcommands) {
			const description = subcommand.summary ?? firstLine(subcommand.description);
			lines.push(`  ${subcommand.id}${description ? ` - ${description}` : ""}`);
		}
	}

	const examples = definition.examples ?? [];
	if (examples.length > 0) {
		lines.push("");
		lines.push("Examples:");
		for (const example of examples) {
			if (typeof example === "string") {
				lines.push(`  ${example}`);
				continue;
			}
			if (example.description) {
				lines.push(`  ${example.description}`);
			}
			lines.push(`  ${example.command}`);
		}
	}

	return { stdout: `${lines.join("\n")}\n`, stderr: "", exitCode: 0 };
}

function topicUsageError(
	definition: AnyCliTopicDefinition,
	path: string[],
	message: string,
): ExecResult {
	const help = topicHelp(definition, path);
	return {
		stdout: help.stdout,
		stderr: message,
		exitCode: 1,
	};
}

/**
 * Returns a usage error result that includes the command help text on stdout.
 */
export function commandUsageError(
	definition: AnyCliCommandDefinition,
	path: string[],
	message: string,
): ExecResult {
	const help = commandHelp(definition, path);
	return {
		stdout: help.stdout,
		stderr: message,
		exitCode: 1,
	};
}

function buildCommandUsage(definition: AnyCliCommandDefinition, path: string[]): string {
	const parts = [path.join(" ")];
	for (const arg of (definition.args ?? []) as readonly CommandArgDefinition[]) {
		const name = arg.multiple ? `${arg.name}...` : arg.name;
		parts.push(arg.required ? `<${name}>` : `[${name}]`);
	}
	const hasFlags = Object.keys(definition.flags ?? {}).length > 0;
	if (hasFlags) {
		parts.push("[flags]");
	}
	return parts.join(" ");
}

function formatFlagLabel(name: string, flag: CommandFlagDefinition): string {
	if (flag.helpLabel) {
		return flag.helpLabel;
	}

	const labels: string[] = [];
	if (flag.char) {
		labels.push(`-${flag.char}`);
	}
	labels.push(`--${name}`);
	if (flag.type === "boolean" && flag.allowNo) {
		labels.push(`--no-${name}`);
	}
	if (flag.type === "string") {
		labels[labels.length - 1] += ` <${flag.helpValue ?? name}>`;
	}
	return labels.join(", ");
}

function formatFlagSummary(flag: CommandFlagDefinition): string {
	const summary = flag.summary ?? flag.description;
	return summary ? ` - ${summary}` : "";
}

function formatIndentedLines(value: string | string[]): string[] {
	if (typeof value === "string") {
		return value.split("\n").map((line) => (line ? `  ${line}` : ""));
	}

	return value.map((line) => (line ? `  ${line}` : ""));
}

function firstLine(value: string | string[] | undefined): string | undefined {
	if (typeof value === "string") {
		return value.split("\n")[0];
	}
	return value?.[0];
}
