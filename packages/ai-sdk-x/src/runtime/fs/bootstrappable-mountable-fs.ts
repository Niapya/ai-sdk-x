import { type IFileSystem, InMemoryFs, MountableFs, type MountableFsOptions } from "just-bash";

type SyncWritableFs = IFileSystem & {
	mkdirSync(path: string, options?: { recursive?: boolean }): void;
	writeFileSync(path: string, content: string | Uint8Array): void;
	writeFileLazy?(
		path: string,
		lazy: () => string | Uint8Array | Promise<string | Uint8Array>,
	): void;
};

interface MountEntry {
	mountPoint: string;
	filesystem: IFileSystem;
}

/**
 * Mountable filesystem that preserves just-bash constructor bootstrapping.
 *
 * just-bash initializes /bin, /dev, /proc, /tmp, and the default home directory
 * only when the fs exposes sync write methods. The upstream MountableFs routes
 * async operations but does not surface those sync capabilities, so this wrapper
 * forwards sync bootstrap writes to the routed backing filesystem when possible.
 */
export class BootstrappableMountableFs extends MountableFs {
	private readonly syncBaseFs: IFileSystem;
	private readonly syncMounts = new Map<string, MountEntry>();
	readonly mkdirSync?: SyncWritableFs["mkdirSync"];
	readonly writeFileSync?: SyncWritableFs["writeFileSync"];
	readonly writeFileLazy?: NonNullable<SyncWritableFs["writeFileLazy"]>;

	constructor(options: MountableFsOptions = {}) {
		const base = options.base ?? new InMemoryFs();
		super({ base });

		this.syncBaseFs = base;

		if (isSyncWritableFs(base)) {
			this.mkdirSync = (path, syncOptions) => {
				const { fs, relativePath } = this.routeSyncPath(path);
				if (!isSyncWritableFs(fs)) {
					throw new Error(`Filesystem mounted for '${path}' does not support mkdirSync`);
				}
				fs.mkdirSync(relativePath, syncOptions);
			};

			this.writeFileSync = (path, content) => {
				const { fs, relativePath } = this.routeSyncPath(path);
				if (!isSyncWritableFs(fs)) {
					throw new Error(`Filesystem mounted for '${path}' does not support writeFileSync`);
				}
				fs.writeFileSync(relativePath, content);
			};
		}

		if (hasLazyWrite(base)) {
			this.writeFileLazy = (path, lazy) => {
				const { fs, relativePath } = this.routeSyncPath(path);
				if (hasLazyWrite(fs)) {
					fs.writeFileLazy(relativePath, lazy);
					return;
				}
				if (!isSyncWritableFs(fs)) {
					throw new Error(`Filesystem mounted for '${path}' does not support sync writes`);
				}
				const content = lazy();
				if (content instanceof Promise) {
					throw new Error(`Lazy file provider for '${path}' returned a Promise during sync init`);
				}
				fs.writeFileSync(relativePath, content);
			};
		}

		for (const mount of options.mounts ?? []) {
			this.mount(mount.mountPoint, mount.filesystem);
		}
	}

	override mount(mountPoint: string, filesystem: IFileSystem): void {
		super.mount(mountPoint, filesystem);
		const normalized = normalizeVirtualPath(mountPoint);
		this.syncMounts.set(normalized, { mountPoint: normalized, filesystem });
	}

	override unmount(mountPoint: string): void {
		super.unmount(mountPoint);
		this.syncMounts.delete(normalizeVirtualPath(mountPoint));
	}

	private routeSyncPath(path: string): { fs: IFileSystem; relativePath: string } {
		const normalized = normalizeVirtualPath(path);
		let bestMatch: MountEntry | null = null;

		for (const entry of this.syncMounts.values()) {
			if (normalized === entry.mountPoint) {
				return { fs: entry.filesystem, relativePath: "/" };
			}

			if (
				normalized.startsWith(`${entry.mountPoint}/`) &&
				(!bestMatch || entry.mountPoint.length > bestMatch.mountPoint.length)
			) {
				bestMatch = entry;
			}
		}

		if (bestMatch) {
			const relativePath = normalized.slice(bestMatch.mountPoint.length);
			return { fs: bestMatch.filesystem, relativePath: relativePath || "/" };
		}

		return { fs: this.syncBaseFs, relativePath: normalized };
	}
}

function isSyncWritableFs(fs: IFileSystem): fs is SyncWritableFs {
	const maybeFs = fs as Partial<SyncWritableFs>;
	return typeof maybeFs.mkdirSync === "function" && typeof maybeFs.writeFileSync === "function";
}

function hasLazyWrite(fs: IFileSystem): fs is SyncWritableFs & {
	writeFileLazy(path: string, lazy: () => string | Uint8Array | Promise<string | Uint8Array>): void;
} {
	return isSyncWritableFs(fs) && typeof fs.writeFileLazy === "function";
}

function normalizeVirtualPath(path: string): string {
	if (!path.includes("\0") && path.startsWith("/")) {
		const parts: string[] = [];
		for (const segment of path.split("/")) {
			if (!segment || segment === ".") continue;
			if (segment === "..") {
				parts.pop();
				continue;
			}
			parts.push(segment);
		}
		return parts.length === 0 ? "/" : `/${parts.join("/")}`;
	}

	throw new Error(`Invalid absolute virtual path '${path}'`);
}
