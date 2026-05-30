import type { PatchCommandOptions, PatchConfig, PatchOptions } from "@/features/patch/types";
import { createPatchCommand } from "@/features/patch/utils/command";
import { createPatchFeatureDescription } from "@/features/patch/utils/description";
import type { Feature } from "@/types";

export function createPatchFeature(option: boolean | PatchOptions | undefined = true): Feature {
	const config: PatchConfig = {
		enabled: option !== false,
	};

	if (!config.enabled) {
		return {
			name: "patch",
		};
	}

	const commandOptions: PatchCommandOptions = {};
	const mainCli = createPatchCommand(commandOptions);

	return {
		name: "patch",
		description: () => createPatchFeatureDescription(),
		command: [mainCli],
	};
}

export { createPatchCommand, createPatchFeatureDescription };
export type { PatchCommandOptions, PatchConfig, PatchOptions } from "@/features/patch/types";
