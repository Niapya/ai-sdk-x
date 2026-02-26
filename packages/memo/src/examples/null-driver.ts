import { tool } from "ai";
import { createStorage } from "unstorage";
import { z } from "zod";
import { createMemo } from "../index";

// Create default storage (no driver specified - uses in-memory storage by default)
const storage = createStorage();

const memo = createMemo({
	storage,
	ttl: 60_000,
	hooks: {
		onHit: (name) => console.log(`[cache hit] ${name}`),
		onMiss: (name) => console.log(`[cache miss] ${name}`),
		onStore: (name) => console.log(`[stored] ${name}`),
	},
});

const weatherTool = tool({
	description: "Get the weather for a location",
	inputSchema: z.object({
		location: z.string().describe("The city name"),
	}),
	outputSchema: z.object({
		location: z.string(),
		temperature: z.number(),
		condition: z.string(),
	}),
	execute: async ({ location }) => {
		console.log(`  -> Fetching weather for ${location}...`);
		return {
			location,
			temperature: Math.round(Math.random() * 40 + 50),
			condition: "sunny",
		};
	},
});

const memoizedWeather = memo(weatherTool, "weather");

// First call - cache miss, actually executes the tool
console.log("=== First call ===");
const result1 = await memoizedWeather.execute(
	{ location: "New York" },
	{ toolCallId: "call-1", messages: [] },
);
console.log("Result:", result1);

// Second call with same args - cache hit, returns cached result
console.log("\n=== Second call (cached) ===");
const result2 = await memoizedWeather.execute(
	{ location: "New York" },
	{ toolCallId: "call-2", messages: [] },
);
console.log("Result:", result2);

// Different args - cache miss
console.log("\n=== Third call (different args) ===");
const result3 = await memoizedWeather.execute(
	{ location: "London" },
	{ toolCallId: "call-3", messages: [] },
);
console.log("Result:", result3);

// Manual cache inspection
console.log("\n=== Manual cache get ===");
const entry = await memoizedWeather.get('memo:weather:{"location":"New York"}');
console.log("Cache entry:", entry);
