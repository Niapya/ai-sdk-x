import type { IFileSystem, MountableFs } from "just-bash";
import { createSubpathFs } from "@/utils/subpath-fs";
import type { MemoryConfig, SkillsConfig, WorkspaceConfig, XConfig } from "@/types";

export function mountIfEnabled(
	fs: MountableFs,
	baseFs: IFileSystem,
	config: MemoryConfig | SkillsConfig | WorkspaceConfig,
	sourceRoot: string,
): string | undefined {
	if (!config.enabled) {
		return undefined;
	}

	const mountedFs = config.fs;
	if (mountedFs) {
		fs.mount(config.mountPoint, mountedFs);
		return undefined;
	}

	if (config.mountPoint !== sourceRoot) {
		fs.mount(config.mountPoint, createSubpathFs(baseFs, sourceRoot));
	}

	return sourceRoot;
}

export async function initializeMounts(
	fs: IFileSystem,
	baseFs: IFileSystem,
	baseInitPaths: string[],
	config: Pick<XConfig, "skills">,
): Promise<void> {
	await Promise.all(baseInitPaths.map((path) => baseFs.mkdir(path, { recursive: true })));

	const lockfilePath = `${config.skills.mountPoint}/skills.json`;
	if (config.skills.enabled && config.skills.lockfile && !(await fs.exists(lockfilePath))) {
		await fs.writeFile(lockfilePath, `${JSON.stringify({ version: 1, skills: {} }, null, 2)}\n`);
	}
}
