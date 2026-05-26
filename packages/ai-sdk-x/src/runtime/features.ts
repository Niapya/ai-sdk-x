import type { Bash, Command, IFileSystem, MountableFs } from "just-bash";
import { createSubpathFs } from "@/runtime/fs/subpath-fs";
import type {
	BashConfig,
	Feature,
	FeatureSetupContext,
	MountedFeatureConfig,
	MountedFeatureOptions,
} from "@/types";

const EXTERNAL_COMMAND_OWNER = "__external__";

interface RegisteredFeatureState {
	commandNames: Set<string>;
	envKeys: Set<string>;
	feature: Feature;
	initialized: boolean;
	initializing?: Promise<void>;
}

export interface FeatureRuntimeState {
	bashConfig: BashConfig;
	baseFs: IFileSystem;
	commandOwners: Map<string, string>;
	commandRegistry: Map<string, Command>;
	envOwners: Map<string, string>;
	featureEnv: Map<string, string>;
	featureRegistry: Map<string, RegisteredFeatureState>;
	fs: MountableFs;
}

export function createFeatureRuntimeState(
	baseFs: IFileSystem,
	fs: MountableFs,
	bashConfig: BashConfig,
): FeatureRuntimeState {
	return {
		baseFs,
		fs,
		bashConfig,
		commandOwners: new Map(),
		commandRegistry: new Map(),
		envOwners: new Map(),
		featureEnv: new Map(),
		featureRegistry: new Map(),
	};
}

export function registerRuntimeCommand(
	state: FeatureRuntimeState,
	bash: Bash,
	command: Command,
	owner = EXTERNAL_COMMAND_OWNER,
): void {
	const registeredCommand =
		command.trusted === undefined
			? {
					...command,
					trusted: true,
				}
			: command;

	state.commandRegistry.set(registeredCommand.name, registeredCommand);
	state.commandOwners.set(registeredCommand.name, owner);
	bash.registerCommand(registeredCommand);
}

export function registerRuntimeFeature(
	state: FeatureRuntimeState,
	bash: Bash,
	feature: Feature,
): void {
	const previous = state.featureRegistry.get(feature.name);
	if (previous) {
		for (const name of previous.commandNames) {
			if (state.commandOwners.get(name) === feature.name) {
				state.commandOwners.delete(name);
				state.commandRegistry.delete(name);
			}
		}

		for (const key of previous.envKeys) {
			if (state.envOwners.get(key) === feature.name) {
				state.envOwners.delete(key);
				state.featureEnv.delete(key);
			}
		}
	}

	const commandNames = new Set<string>();
	for (const command of feature.command ?? []) {
		registerRuntimeCommand(state, bash, command, feature.name);
		commandNames.add(command.name);
	}

	const envKeys = new Set<string>();
	for (const [key, value] of Object.entries(feature.env ?? {})) {
		state.featureEnv.set(key, value);
		state.envOwners.set(key, feature.name);
		envKeys.add(key);
	}

	state.featureRegistry.set(feature.name, {
		feature,
		initialized: false,
		commandNames,
		envKeys,
	});
}

export function listRuntimeCommands(state: FeatureRuntimeState): Command[] {
	return Array.from(state.commandRegistry.values());
}

export function listRuntimeFeatures(state: FeatureRuntimeState): Feature[] {
	return Array.from(state.featureRegistry.values()).map((entry) => entry.feature);
}

export function resolveRuntimeFeatureEnv(state: FeatureRuntimeState): Record<string, string> {
	return Object.fromEntries(state.featureEnv.entries());
}

export async function ensureRuntimeFeaturesInitialized(
	state: FeatureRuntimeState,
	createContext: () => FeatureSetupContext,
): Promise<void> {
	const pending: Promise<void>[] = [];

	for (const entry of state.featureRegistry.values()) {
		if (entry.initialized) {
			continue;
		}

		if (!entry.initializing) {
			entry.initializing = (async () => {
				if (entry.feature.init) {
					await entry.feature.init(createContext());
				}
				entry.initialized = true;
			})().finally(() => {
				entry.initializing = undefined;
			});
		}

		pending.push(entry.initializing);
	}

	await Promise.all(pending);
}

export function resolveFeatureEnabled(option: boolean | object | undefined): boolean {
	return option !== false;
}

export function resolveFeatureOption<TOptions>(
	option: boolean | TOptions | undefined,
): TOptions | undefined {
	return typeof option === "object" ? option : undefined;
}

export function resolveMountedFeatureConfig<TOptions extends MountedFeatureOptions>(
	option: boolean | TOptions | undefined,
	defaultMount: string,
): MountedFeatureConfig {
	const resolvedOption = resolveFeatureOption(option);

	return {
		enabled: resolveFeatureEnabled(option),
		fs: resolvedOption?.fs,
		mountPoint: resolvedOption?.mountPoint ?? defaultMount,
	};
}

export async function initializeMountedFeature(
	context: FeatureSetupContext,
	config: MountedFeatureConfig,
	sourceRoot: string,
): Promise<void> {
	if (!config.enabled) {
		return;
	}

	if (config.fs) {
		context.fs.mount(config.mountPoint, config.fs);
		return;
	}

	if (config.mountPoint !== sourceRoot) {
		context.fs.mount(config.mountPoint, createSubpathFs(context.baseFs, sourceRoot));
	}

	await context.baseFs.mkdir(sourceRoot, { recursive: true });
}
