import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import { createSkill } from "../index";

const storage = createStorage({ driver: memoryDriver() });

const skill = createSkill({
	storage,
	download: async (gitURL) => {
		// Download skills from gitURL, and upload to S3 (or any storage)
		console.log(`  -> Downloading from ${gitURL}...`);

		// return the list of skills downloaded
		return [
			{
				name: "search",
				description: "Web search skill",
				version: "1.0.0",
				gitURL,
			},
			{
				name: "summarize",
				description: "Text summarization skill",
				version: "1.0.0",
				gitURL,
			},
		];
	},
	get: async (name) => {
		// Get skill content from S3 (or any storage) by name
		console.log(`  -> Getting skill: ${name}`);
		return {
			name,
			description: `${name} skill description`,
			version: "1.0.0",
			contenet: `This is the content of the ${name} skill.`,
		};
	},
	hooks: {
		onList: (skills) => console.log(`[hook] listed ${skills.length} skills`),
		onGet: (name, detail) =>
			console.log(`[hook] got skill: ${name}`, detail ? "found" : "not found"),
		onDownload: (url) => console.log(`[hook] downloading: ${url}`),
		onIndexUpdate: (index) => console.log(`[hook] index updated, ${index.skills.length} skills`),
	},
	debug: {
		enabled: true,
		logger: (msg) => console.log(`[debug] ${msg}`),
	},
});

const instance = skill();

// Download skills
console.log("=== Download skills ===");
await instance.download("https://github.com/test/skills-repo");

// List skills
console.log("\n=== List skills ===");
const skills = await instance.list();
console.log("Skills:", skills);

// Get a specific skill
console.log("\n=== Get skill ===");
const detail = await instance.get("search");
console.log("Detail:", detail);

// Get tools
console.log("\n=== Get tools ===");
const tools = await instance.getTools();
console.log("Available tools:", Object.keys(tools));
