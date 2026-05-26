import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";
import { X } from "ai-sdk-x";
import { ReadWriteFs } from "just-bash";

const colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
};

class VirtualRepl {
	private readonly rl: readline.Interface;
	private readonly tool: X;
	private readonly root: string;
	private cwd = "/home/user";
	private running = true;

	constructor() {
		this.root = resolve(dirname(fileURLToPath(import.meta.url)), "../shell");
		mkdirSync(this.root, { recursive: true });
		const fs = new ReadWriteFs({ root: this.root });
		this.tool = X.init({
			fs,
		}).registerCommand({
			name: "test",
			async execute(args, ctx) {
				ctx.exec?.("asdasdsa", {
					cwd: "",
				});

				return {
					stdout: `You ran the test command with args: ${args.join(" ")} and cwd: ${ctx.cwd}`,
					stderr: "",
					exitCode: 0,
				};
			},
		});

		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: process.stdin.isTTY,
		});

		this.rl.on("SIGINT", () => {
			process.stdout.write("^C\n");
			process.exit(0);
		});

		if (process.stdin.isTTY) {
			this.rl.on("close", () => {
				this.running = false;
				process.exit(0);
			});
		}
	}

	private printWelcome(): void {
		console.log(`${colors.cyan}${colors.bold}AI SDK X Bash REPL${colors.reset}`);
		console.log(`${colors.dim}Type a bash command, or 'Ctrl+C' to quit.${colors.reset}`);
		console.log(`${colors.dim}The root directory is: ${this.root}${colors.reset}\n`);
	}

	private getPrompt(): string {
		return `${colors.green}${colors.bold}ai-sdk-x${colors.reset}:${colors.blue}${this.cwd}${colors.reset}$ `;
	}

	private async executeCommand(command: string): Promise<void> {
		const trimmed = command.trim();
		if (!trimmed) {
			return;
		}

		const result = await this.tool.exec(trimmed, {
			cwd: this.cwd,
		});

		if (result.stdout) {
			process.stdout.write(result.stdout);
		}

		if (result.stderr) {
			process.stderr.write(`${colors.red}${result.stderr}${colors.reset}`);
		}

		if (result.env.PWD) {
			this.cwd = result.env.PWD;
		}
	}

	private prompt(): void {
		if (!this.running) {
			return;
		}

		this.rl.question(this.getPrompt(), async (answer) => {
			try {
				await this.executeCommand(answer);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				process.stderr.write(`${colors.red}${message}${colors.reset}\n`);
			}
			this.prompt();
		});
	}

	async run(): Promise<void> {
		if (process.stdin.isTTY) {
			this.printWelcome();
			this.prompt();
			return;
		}

		for await (const line of this.rl) {
			if (!this.running) {
				break;
			}

			await this.executeCommand(line);
		}
	}
}

const repl = new VirtualRepl();
await repl.run();
