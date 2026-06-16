import type { IFileSystem } from "just-bash";

export interface LockfileOptions<T> {
	createEmpty: () => T;
	filename: string;
	fs: IFileSystem;
	isValid?: (value: unknown) => value is T;
	mountPoint: string;
	parse?: (value: unknown) => T | undefined;
}

export async function readLockfile<T>(options: LockfileOptions<T>): Promise<T> {
	const path = options.fs.resolvePath(options.mountPoint, options.filename);
	if (!(await options.fs.exists(path))) {
		return options.createEmpty();
	}

	try {
		const parsed = JSON.parse(await options.fs.readFile(path));
		if (options.parse) {
			return options.parse(parsed) ?? options.createEmpty();
		}

		return options.isValid?.(parsed) ? parsed : options.createEmpty();
	} catch {
		return options.createEmpty();
	}
}

export async function writeLockfile<T>(
	options: Pick<LockfileOptions<T>, "filename" | "fs" | "mountPoint">,
	value: T,
): Promise<void> {
	await options.fs.mkdir(options.mountPoint, { recursive: true });
	await options.fs.writeFile(
		options.fs.resolvePath(options.mountPoint, options.filename),
		`${JSON.stringify(value, null, 2)}\n`,
	);
}

export async function initLockfile<T>(
	options: LockfileOptions<T>,
	beforeWrite?: (value: T) => Promise<void> | void,
): Promise<T> {
	const value = await readLockfile(options);
	await beforeWrite?.(value);
	await writeLockfile(options, value);
	return value;
}

export function resolveTokenPath(
	fs: IFileSystem,
	mountPoint: string,
	token: string,
	path: string,
): string {
	if (path === token) {
		return mountPoint;
	}
	if (path.startsWith(`${token}/`)) {
		return fs.resolvePath(mountPoint, path.slice(token.length + 1));
	}
	return path;
}

export function toTokenPath(
	fs: IFileSystem,
	mountPoint: string,
	token: string,
	path: string,
): string {
	const normalizedMount = fs.resolvePath("/", mountPoint);
	const normalizedPath = fs.resolvePath("/", path);

	if (normalizedPath === normalizedMount) {
		return token;
	}
	if (normalizedPath.startsWith(`${normalizedMount}/`)) {
		return `${token}${normalizedPath.slice(normalizedMount.length)}`;
	}

	return path;
}
