import type { KVStorage } from "@/types/storage";

export interface MemoryCommandOptions {
	cache?: KVStorage;
	mountPoint: string;
	now?: () => Date;
}
