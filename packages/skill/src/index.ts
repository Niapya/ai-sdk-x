import type { Tool } from "ai";
import { tool } from "ai";
import type { Storage } from "unstorage";
import { z } from "zod";

// biome-ignore lint/suspicious/noExplicitAny: Skill type is any.
type Skill = any;

export interface SkillMeta {
	name: string;
	description: string;
}

export interface SkillDetail {
	name: string;
	description: string;
	version: string;
	gitURL: string;

	/**
	 * All files of The skill, relative to the root of the repository.
	 */
	files?: string[];
	/**
	 * Additional metadata fields, which can be used to store any extra information about the skill.
	 */
	additional?: Record<string, unknown>;
}

export interface SkillIndex {
	skills: SkillMeta[];
	updateTime: number;
}

export interface SkillDebugOptions {
	enabled: boolean;
	logger?: (message: string) => void;
}

export interface SkillHooks {
	onList?: (skills: SkillMeta[]) => void;
	onGet?: (name: string, skill: SkillDetail | null) => void;
	onDownload?: (name: string) => void;
	onIndexUpdate?: (index: SkillIndex) => void;
}

export interface SkillOptions {
	storage: Storage;

	/**
	 * Index key for storing the skill list. Default is "skills".
	 */
	indexKey?: string;
	generateKey?: (name: string) => string;

	/**
	 * Download a skill from a git URL.
	 *
	 * You need to implement the logic to clone the repository, read the skill manifest, and return the skill meta info.
	 * The skill detail will be stored in the storage.
	 * @param gitURL
	 * @returns
	 */
	download: (gitURL: string) => Promise<SkillDetail[]>;

	/**
	 * Get a skill by name.
	 *
	 * @param name
	 * @returns
	 */
	get: (name: string) => Promise<Skill | null>;
	hooks?: SkillHooks;
	debug?: SkillDebugOptions;
}

export interface SkillConfig {
	hooks?: SkillHooks;
}

export interface SkillInstance {
	list: () => Promise<SkillMeta[]>;
	get: (name: string) => Promise<Skill | null>;
	download: (gitURL: string) => Promise<SkillDetail[]>;
	getTools: () => Promise<Record<string, Tool>>;
}

/**
 * createSkill is a factory function that generates a skill tool.
 *
 * @param options
 * @returns skill builder function, which can be used to create a skill instance with optional hooks.
 */
export function createSkill(options: SkillOptions) {
	const { storage, download, get, hooks, debug, indexKey, generateKey } = options;

	const INDEX_KEY = indexKey ?? "skills";
	function skillKey(name: string): string {
		return generateKey ? generateKey(name) : `skills:${name}`;
	}

	function debugLog(message: string): void {
		if (debug?.enabled) {
			const logger = debug.logger ?? console.log;
			logger(message);
		}
	}

	return function skill(config?: SkillConfig): SkillInstance {
		const effectiveHooks = config?.hooks ?? hooks;

		async function getIndex(): Promise<SkillIndex> {
			const raw = await storage.getItem<SkillIndex>(INDEX_KEY);
			if (raw) {
				return raw;
			}
			return { skills: [], updateTime: 0 };
		}

		async function saveIndex(index: SkillIndex): Promise<void> {
			await storage.setItem(INDEX_KEY, index);
			effectiveHooks?.onIndexUpdate?.(index);
		}

		const instance = {
			list: async () => {
				debugLog("[skill] list");
				const skillsIndex = await getIndex();
				const skills = skillsIndex.skills;
				effectiveHooks?.onList?.(skills);

				return skills;
			},

			get: async (name: string) => {
				debugLog(`[skill] get name="${name}"`);
				const detail = await get(name);
				effectiveHooks?.onGet?.(name, detail);

				if (detail) {
					await storage.setItem(skillKey(name), detail);
				}

				return detail;
			},

			download: async (gitURL: string) => {
				debugLog(`[skill] download gitURL="${gitURL}"`);
				effectiveHooks?.onDownload?.(gitURL);
				const details = await download(gitURL);

				// Save skill details
				for (const detail of details) {
					await storage.setItem(skillKey(detail.name), detail);
				}

				// Update index
				const index = await getIndex();
				for (const detail of details) {
					const existing = index.skills.findIndex((s) => s.name === detail.name);
					const meta: SkillMeta = { name: detail.name, description: detail.description };
					if (existing >= 0) {
						index.skills[existing] = meta;
					} else {
						index.skills.push(meta);
					}
				}
				index.updateTime = Date.now();
				await saveIndex(index);

				return details;
			},

			getTools: async () => ({
				listSkills: tool({
					description: "List all available skills.",
					inputSchema: z.object({}),
					execute: async () => {
						return instance.list();
					},
				}),
				getSkill: tool({
					description: "Get details of a specific skill by name.",
					inputSchema: z.object({
						name: z.string(),
					}),
					execute: async ({ name }) => {
						return instance.get(name);
					},
				}),

				downloadSkill: tool({
					description: "Download and install a skill by name.",
					inputSchema: z.object({
						url: z.url(),
					}),
					execute: async ({ url }) => {
						return instance.download(url);
					},
				}),
			}),
		};

		return instance;
	};
}
