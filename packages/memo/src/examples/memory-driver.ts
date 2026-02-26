import { tool } from "ai";
import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/memory";
import { z } from "zod";
import { createMemo } from "../index";

// Create storage with explicit memory driver
const storage = createStorage({ driver: memoryDriver() });

const memo = createMemo({
	storage,
	ttl: 30_000,
	debug: { enabled: true },
	hooks: {
		onHit: (name, params) => console.log(`[HIT] ${name}`, JSON.stringify(params)),
		onMiss: (name, params) => console.log(`[MISS] ${name}`, JSON.stringify(params)),
		onStore: (name, params) => console.log(`[STORE] ${name}`, JSON.stringify(params)),
	},
});

const searchTool = tool({
	description: "Search the web",
	inputSchema: z.object({
		query: z.string().describe("Search query"),
	}),
	outputSchema: z.object({
		query: z.string(),
		results: z.array(z.string()).describe("Search results"),
	}),
	execute: async ({ query }) => {
		console.log(`  -> Searching for: ${query}`);
		return {
			query,
			results: [`Result 1 for "${query}"`, `Result 2 for "${query}"`],
		};
	},
});

const memoizedSearch = memo(searchTool, "search");

// First call - executes the search
console.log("=== First search ===");
const r1 = await memoizedSearch.execute(
	{ query: "TypeScript" },
	{ toolCallId: "call-1", messages: [] },
);
console.log("Result:", r1);

// Second call - returns from cache
console.log("\n=== Second search (cached) ===");
const r2 = await memoizedSearch.execute(
	{ query: "TypeScript" },
	{ toolCallId: "call-2", messages: [] },
);
console.log("Result:", r2);

// Manual cache management
console.log("\n=== Manual cache management ===");
const entry = await memoizedSearch.get('memo:search:{"query":"TypeScript"}');
console.log("Get entry:", entry);

// Update cache entry manually
await memoizedSearch.update('memo:search:{"query":"TypeScript"}', {
	query: "TypeScript",
	results: ["Updated result"],
});
console.log("Updated cache entry");

const updated = await memoizedSearch.get('memo:search:{"query":"TypeScript"}');
console.log("After update:", updated);

// Delete cache entry
await memoizedSearch.delete('memo:search:{"query":"TypeScript"}');
console.log("Deleted cache entry");

const deleted = await memoizedSearch.get('memo:search:{"query":"TypeScript"}');
console.log("After delete:", deleted);
