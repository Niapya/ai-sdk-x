import { createStorage } from "unstorage";
import memoryDriver from "unstorage/drivers/deno-kv";
import { execute } from "../index";

// use Deno KV
const storage = createStorage({ driver: memoryDriver({}) });

const tools = execute({
	
	// Deno only supports JavaScript
	lang: ["javascript"],

	storage,

	execute: async ({ language, code }) => {
		console.log(`  -> Executing ${language} code`);
		
		// Capture console output
		const logs: string[] = [];
		const originalLog = console.log;
		console.log = (...args: unknown[]) => {
			logs.push(args.map(arg => {
				if (typeof arg === 'object') {
					return JSON.stringify(arg);
				}
				return String(arg);
			}).join(' '));
		};

		try {
			// Use data URL to dynamically import and execute code
			const dataUrl = `data:text/javascript,${encodeURIComponent(`export default async () => { ${code} }`)}`;
			const module = await import(dataUrl);
			await module.default?.();

			return logs.length > 0 ? logs.join('\n') : 'Executed successfully';
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return `Error: ${errorMessage}`;
		} finally {
			// Restore original console.log
			console.log = originalLog;
		}
	},

	kill: async (id) => {
		console.log(`  -> Killing execution ${id}`);
	},

	maxDelay: 5000,

	hooks: {
		onExecute: (id, payload) =>
			console.log(`[EXECUTE] ${id} lang=${payload.language}`),
		onComplete: (id, result) => console.log(`[COMPLETE] ${id} result=${result}`),
		onTimeout: (id) => console.log(`[TIMEOUT] ${id}`),
		onError: (id, error) => console.log(`[ERROR] ${id}`, error),
		onKill: (id) => console.log(`[KILL] ${id}`),
		onGetResult: (id, record) =>
			console.log(`[GET] ${id} status=${record?.status ?? "not found"}`),
	},
	
	debug: { enabled: true },
});

// Execute JavaScript code
console.log("=== Execute JavaScript ===");
const jsResult = await tools.execute_code.execute?.(
	{ language: "javascript", code: "console.log('Hello from JavaScript!')" },
	{ toolCallId: "call-1", messages: [] },
);
console.log("JS Result:", jsResult);

// Execute JavaScript with multiple statements
console.log("\n=== Execute with multiple statements ===");
const multiResult = await tools.execute_code.execute?.(
	{ 
		language: "javascript", 
		code: `
			const x = 5;
			const y = 10;
			console.log(\`Sum: \${x + y}\`);
		` 
	},
	{ toolCallId: "call-2", messages: [] },
);
console.log("Multi Result:", multiResult);

// Demonstrate ESM module import example
console.log("\n=== Execute with module import ===");
const moduleResult = await tools.execute_code.execute?.(
	{ 
		language: "javascript", 
		code: `
			// You can import external modules here
			const data = { message: 'Running with real code execution' };
			console.log(JSON.stringify(data));
		` 
	},
	{ toolCallId: "call-3", messages: [] },
);
console.log("Module Result:", moduleResult);
