import type { IFileSystem } from "just-bash";

export async function collectMemoryFiles(fs: IFileSystem, memoryMount: string): Promise<string[]> {
	if (!(await fs.exists(memoryMount))) {
		return [];
	}

	const paths: string[] = [];
	const longTermPath = fs.resolvePath(memoryMount, "MEMORY.md");
	if (await fs.exists(longTermPath)) {
		paths.push(longTermPath);
	}

	const dailyRoot = fs.resolvePath(memoryMount, "daily");
	if (await fs.exists(dailyRoot)) {
		for (const date of await fs.readdir(dailyRoot)) {
			const datePath = fs.resolvePath(dailyRoot, date);
			const stat = await fs.stat(datePath);
			if (!stat.isDirectory) {
				continue;
			}
			for (const file of await fs.readdir(datePath)) {
				const filePath = fs.resolvePath(datePath, file);
				const fileStat = await fs.stat(filePath);
				if (fileStat.isFile && file.endsWith(".md")) {
					paths.push(filePath);
				}
			}
		}
	}

	return paths.sort();
}

export function formatDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
	const day = `${date.getUTCDate()}`.padStart(2, "0");
	return `${year}-${month}-${day}`;
}
