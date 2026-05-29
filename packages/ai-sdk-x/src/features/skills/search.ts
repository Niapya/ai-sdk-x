import type { ExecResult } from "just-bash";
import { commandError, defineCliCommand } from "@/utils/command";

const SEARCH_API_BASE = process.env.SKILLS_API_URL || "https://skills.sh";

interface SearchSkill {
	installs: number;
	name: string;
	slug: string;
	source: string;
}

export async function searchSkills(query: string): Promise<ExecResult> {
	const normalizedQuery = query.trim();
	if (!normalizedQuery) {
		return commandError("x-skills search: missing query\n", 1);
	}

	const results = await searchSkillsApi(normalizedQuery);
	if (results.length === 0) {
		return {
			stdout: `No skills found for "${normalizedQuery}"\n`,
			stderr: "",
			exitCode: 0,
		};
	}

	const lines = [
		`
Install with x-skills install <git-url@skill>.
Example:
	x-skills install https://github.com/intellectronica/agent-skills@context7
`,
	];

	for (const skill of results.slice(0, 6)) {
		const pkg = skill.source || skill.slug;
		const installs = formatInstalls(skill.installs);
		lines.push(`${pkg}@${skill.name}${installs ? ` (${installs})` : ""}`);
		lines.push(`https://skills.sh/${skill.slug}`);
		lines.push("");
	}

	return {
		stdout: `${lines.join("\n").trimEnd()}\n`,
		stderr: "",
		exitCode: 0,
	};
}

async function searchSkillsApi(query: string): Promise<SearchSkill[]> {
	try {
		const url = `${SEARCH_API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=10`;
		const response = await fetch(url);

		if (!response.ok) {
			return [];
		}

		const data = (await response.json()) as {
			skills: Array<{
				id: string;
				installs: number;
				name: string;
				source: string;
			}>;
		};

		return data.skills
			.map((skill) => ({
				installs: skill.installs,
				name: sanitizeMetadata(skill.name),
				slug: sanitizeMetadata(skill.id),
				source: sanitizeMetadata(skill.source || ""),
			}))
			.sort((left, right) => (right.installs || 0) - (left.installs || 0));
	} catch {
		return [];
	}
}

function formatInstalls(count: number): string {
	if (!count || count <= 0) {
		return "";
	}
	if (count >= 1_000_000) {
		return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M installs`;
	}
	if (count >= 1_000) {
		return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K installs`;
	}
	return `${count} install${count === 1 ? "" : "s"}`;
}

function sanitizeMetadata(value: string): string {
	let sanitized = "";
	let previousWasSpace = false;

	for (const character of value) {
		const codePoint = character.codePointAt(0) ?? 0;
		const isControl = codePoint < 0x20 || codePoint === 0x7f;
		if (isControl) {
			if (!previousWasSpace) {
				sanitized += " ";
				previousWasSpace = true;
			}
			continue;
		}

		sanitized += character;
		previousWasSpace = character === " ";
	}

	return sanitized.trim();
}

export function createSearchSkillsCommand(): ReturnType<typeof defineCliCommand> {
	return defineCliCommand({
		id: "search",
		type: "command",
		summary: "Search the remote skill index.",
		usage: "x-skills search <query>",
		args: [
			{
				name: "query",
				multiple: true,
				required: true,
				summary: "Search text.",
			},
		],
		run: ({ args: { query } }) => searchSkills(query.join(" ")),
	});
}
