import { describe, expect, it } from "bun:test";
import {
	commandError,
	commandUsageError,
	createCommand,
	defineCliCommand,
	defineCliTopic,
	hasHelpFlag,
	showHelp,
} from "./index";

describe("command helpers", () => {
	it("builds a shell-like command error", () => {
		expect(commandError("boom\n", 9)).toEqual({
			stdout: "",
			stderr: "boom\n",
			exitCode: 9,
		});
	});

	it("detects help flag before -- delimiter", () => {
		expect(hasHelpFlag(["--help"])).toBe(true);
		expect(hasHelpFlag(["-h"])).toBe(true);
		expect(hasHelpFlag(["--", "--help"])).toBe(false);
		expect(hasHelpFlag(["x", "--help"])).toBe(true);
		expect(hasHelpFlag(["x", "--", "-h"])).toBe(false);
	});

	it("renders standalone help documents", () => {
		const result = showHelp({
			name: "x-echo",
			summary: "Echo helper",
			usage: "x-echo <text>",
			description: ["line one", "line two"],
			options: ["--upper"],
			examples: ["x-echo hi"],
			notes: ["trusted command"],
		});

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain("x-echo - Echo helper");
		expect(result.stdout).toContain("Usage: x-echo <text>");
		expect(result.stdout).toContain("Options:\n  --upper");
		expect(result.stdout).toContain("Examples:\n  x-echo hi");
		expect(result.stdout).toContain("Notes:\n  trusted command");
	});
});

describe("createCommand", () => {
	it("keeps trusted metadata for compiled commands", () => {
		const command = createCommand(
			defineCliCommand({
				id: "safe",
				type: "command",
				trusted: true,
				run: () => ({ stdout: "ok", stderr: "", exitCode: 0 }),
			}),
		);

		expect(command.trusted).toBe(true);
	});

	it("routes topic subcommands by id and alias", async () => {
		const root = defineCliTopic({
			id: "x-demo",
			type: "topic",
			subcommands: [
				defineCliCommand({
					id: "run",
					type: "command",
					aliases: ["go"],
					strict: false,
					run: ({ argv }) => ({ stdout: argv.join("|"), stderr: "", exitCode: 0 }),
				}),
			],
		});
		const command = createCommand(root);

		const byId = await command.execute(["run", "a", "b"], {} as never);
		expect(byId.stdout).toBe("a|b");

		const byAlias = await command.execute(["go", "c"], {} as never);
		expect(byAlias.stdout).toBe("c");
	});

	it("renders topic help when no subcommand is provided", async () => {
		const root = defineCliTopic({
			id: "x-demo",
			type: "topic",
			summary: "Demo topic",
			description: "Top level command",
			examples: [{ command: "x-demo run", description: "Run demo" }],
			subcommands: [
				defineCliCommand({
					id: "run",
					type: "command",
					summary: "Run it",
					run: () => ({ stdout: "", stderr: "", exitCode: 0 }),
				}),
			],
		});

		const result = await createCommand(root).execute([], {} as never);
		expect(result.stdout).toContain("Usage: x-demo <command>");
		expect(result.stdout).toContain("Commands:\n  run - Run it");
		expect(result.stdout).toContain("Examples:\n  Run demo\n  x-demo run");
	});

	it("returns topic usage errors for unknown subcommands", async () => {
		const root = defineCliTopic({
			id: "x-demo",
			type: "topic",
			subcommands: [],
		});
		const result = await createCommand(root).execute(["missing"], {} as never);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("unknown command: missing");
		expect(result.stdout).toContain("Usage: x-demo <command>");
	});

	it("shows topic help if help flag is present for unknown subcommand", async () => {
		const root = defineCliTopic({
			id: "x-demo",
			type: "topic",
			subcommands: [],
		});
		const result = await createCommand(root).execute(["missing", "--help"], {} as never);

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("Usage: x-demo <command>");
	});
});

describe("command parser and help", () => {
	const runInputs: unknown[] = [];
	const commandDefinition = defineCliCommand({
		id: "x-copy",
		type: "command",
		summary: "Copy files",
		description: ["Copies source to destination."],
		usage: "x-copy <src> [dest] [extras...] [flags]",
		examples: [
			{
				description: "Copy once",
				command: "x-copy a.txt b.txt",
			},
		],
		args: [
			{
				name: "src",
				required: true,
				summary: "Source path",
			},
			{
				name: "dest",
				default: "out.txt",
			},
			{
				name: "extras",
				multiple: true,
				options: ["fast", "safe"],
			},
		] as const,
		flags: {
			verbose: {
				type: "boolean",
				char: "v",
				allowNo: true,
				summary: "Verbose output",
			},
			mode: {
				type: "string",
				aliases: ["m"],
				options: ["safe", "fast"],
				required: true,
				helpValue: "name",
			},
			tag: {
				type: "string",
				char: "t",
				multiple: true,
			},
			dryRun: {
				type: "boolean",
				default: false,
			},
		},
		run: (input) => {
			runInputs.push(input);
			return {
				stdout: JSON.stringify(input),
				stderr: "",
				exitCode: 0,
			};
		},
	});

	const compiled = createCommand(commandDefinition);

	it("renders command help when -h or --help is passed", async () => {
		const byShortFlag = await compiled.execute(["-h"], {} as never);
		expect(byShortFlag.stdout).toContain("Usage: x-copy <src> [dest] [extras...] [flags]");
		expect(byShortFlag.stdout).toContain("Flags:");
		expect(byShortFlag.stdout).toContain("-v, --verbose, --no-verbose - Verbose output");
		expect(byShortFlag.stdout).toContain("--mode <name>");

		const byLongFlag = await compiled.execute(["--help"], {} as never);
		expect(byLongFlag.exitCode).toBe(0);
		expect(byLongFlag.stderr).toBe("");
	});

	it("parses args and flags including defaults aliases and -- delimiter", async () => {
		const result = await compiled.execute(
			["source.txt", "dest.txt", "fast", "safe", "--mode", "safe", "-v", "-t", "a", "-t", "b"],
			{} as never,
		);

		expect(result.exitCode).toBe(0);
		expect(runInputs.length).toBe(1);
		expect(runInputs[0]).toEqual({
			argv: [
				"source.txt",
				"dest.txt",
				"fast",
				"safe",
				"--mode",
				"safe",
				"-v",
				"-t",
				"a",
				"-t",
				"b",
			],
			args: {
				src: "source.txt",
				dest: "dest.txt",
				extras: ["fast", "safe"],
			},
			flags: {
				verbose: true,
				mode: "safe",
				tag: ["a", "b"],
				dryRun: false,
			},
		});

		const positionalAfterDelimiter = await compiled.execute(
			["source.txt", "--mode", "fast", "--", "safe"],
			{} as never,
		);
		expect(positionalAfterDelimiter.exitCode).toBe(0);
		expect(runInputs[1]).toEqual({
			argv: ["source.txt", "--mode", "fast", "--", "safe"],
			args: {
				src: "source.txt",
				dest: "safe",
				extras: undefined,
			},
			flags: {
				verbose: undefined,
				mode: "fast",
				tag: undefined,
				dryRun: false,
			},
		});
	});

	it("returns usage errors for invalid flag and arg inputs", async () => {
		const cases: Array<{ argv: string[]; expected: string }> = [
			{ argv: ["source.txt", "--mode"], expected: "Missing value for flag: --mode" },
			{ argv: ["source.txt", "--mode=weird"], expected: "Expected --mode to be one of" },
			{ argv: ["source.txt", "--no-mode"], expected: "Nonexistent flag: --no-mode" },
			{ argv: ["source.txt", "--unknown"], expected: "Nonexistent flag: --unknown" },
			{ argv: ["source.txt", "--verbose=true"], expected: "Unexpected value for boolean flag" },
			{ argv: ["source.txt", "-x"], expected: "Nonexistent flag: -x" },
			{ argv: ["source.txt", "-vm", "safe"], expected: "Unsupported flag syntax: -vm" },
			{
				argv: ["source.txt", "dest.txt", "oops", "--mode", "safe"],
				expected: "Expected extras to be one of",
			},
			{ argv: ["--mode", "safe"], expected: "Missing required arg: src" },
			{ argv: ["source.txt"], expected: "Missing required flag: --mode" },
		];

		for (const testCase of cases) {
			const result = await compiled.execute(testCase.argv, {} as never);
			expect(result.exitCode).toBe(1);
			expect(result.stderr).toContain(testCase.expected);
			expect(result.stdout).toContain("Usage: x-copy <src> [dest] [extras...] [flags]");
		}
	});

	it("fails on unexpected trailing args in strict mode", async () => {
		const strictCommand = createCommand(
			defineCliCommand({
				id: "x-one",
				type: "command",
				args: [{ name: "arg", required: true }],
				run: () => ({ stdout: "", stderr: "", exitCode: 0 }),
			}),
		);

		const result = await strictCommand.execute(["a", "b"], {} as never);
		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain("Unexpected arg: b");
	});

	it("supports non-strict commands with extra args", async () => {
		const command = createCommand(
			defineCliCommand({
				id: "x-flex",
				type: "command",
				strict: false,
				args: [{ name: "first", required: true }],
				run: ({ args }) => ({
					stdout: String(args.first),
					stderr: "",
					exitCode: 0,
				}),
			}),
		);

		const result = await command.execute(["a", "b", "c"], {} as never);
		expect(result.exitCode).toBe(0);
		expect(result.stdout).toBe("a");
	});

	it("returns explicit command usage errors helper output", () => {
		const result = commandUsageError(
			defineCliCommand({
				id: "x-run",
				type: "command",
				usage: "x-run <task>",
				run: () => ({ stdout: "", stderr: "", exitCode: 0 }),
			}),
			["x-run"],
			"bad input\n",
		);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toBe("bad input\n");
		expect(result.stdout).toContain("Usage: x-run <task>");
	});
});
