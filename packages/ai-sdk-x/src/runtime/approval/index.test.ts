import { describe, expect, it } from "bun:test";
import { analyzeBashApproval, BashApprovalDeniedError } from "./index";

describe("analyzeBashApproval", () => {
	it("evaluates each command in a pipeline separately", () => {
		const decision = analyzeBashApproval("echo hi | grep h && rm -rf build", {
			defaultAction: "allow",
			rules: {
				"rm *": "deny",
				"grep *": "allow",
			},
		});

		expect(decision.action).toBe("deny");
		expect(decision.commands.map((item) => `${item.command.raw}:${item.action}`)).toEqual([
			"echo hi:allow",
			"grep h:allow",
			"rm -rf build:deny",
		]);
		expect(decision.denied.map((item) => item.command.raw)).toEqual(["rm -rf build"]);
	});

	it("folds command decisions as deny over ask over allow", () => {
		const deny = analyzeBashApproval("echo hello && rm -rf /", {
			defaultAction: "allow",
			rules: {
				"echo *": "ask",
				"rm *": "deny",
			},
		});
		const ask = analyzeBashApproval("echo hello && pwd", {
			defaultAction: "allow",
			rules: {
				"echo *": "ask",
				pwd: "allow",
			},
		});
		const allow = analyzeBashApproval("echo hello && pwd", {
			rules: {
				"*": "allow",
			},
		});

		expect(deny.action).toBe("deny");
		expect(deny.denied.map((item) => item.command.raw)).toEqual(["rm -rf /"]);
		expect(ask.action).toBe("ask");
		expect(allow.action).toBe("allow");
	});

	it("recursively collects nested command substitutions", () => {
		const decision = analyzeBashApproval("echo $(rm -rf build)", {
			defaultAction: "allow",
			rules: {
				"rm *": "deny",
			},
		});

		expect(decision.action).toBe("deny");
		expect(decision.commands.map((item) => item.command.raw)).toEqual([
			"echo $(rm -rf build)",
			"rm -rf build",
		]);
	});

	it("uses dynamicAction when parsing fails", () => {
		const decision = analyzeBashApproval("diff <(sort a.txt) <(rm -rf build)", {
			defaultAction: "allow",
			dynamicAction: "ask",
			rules: {
				"rm *": "deny",
			},
		});
		const deny = analyzeBashApproval("diff <(sort a.txt) <(rm -rf build)", {
			defaultAction: "allow",
			dynamicAction: "deny",
		});

		expect(decision.action).toBe("ask");
		expect(decision.commands).toEqual([
			{
				action: "ask",
				command: {
					raw: "diff <(sort a.txt) <(rm -rf build)",
					head: null,
					tail: [],
					staticCommand: false,
				},
				pattern: "*",
			},
		]);
		expect(deny.action).toBe("deny");
		expect(deny.denied).toHaveLength(1);
	});

	it("contains parse failures to arithmetic substitutions", () => {
		const decision = analyzeBashApproval("echo $(( $(diff <(a)) + 1 )) && pwd", {
			defaultAction: "allow",
			dynamicAction: "ask",
			rules: {
				pwd: "allow",
			},
		});

		expect(decision.action).toBe("ask");
		expect(decision.commands.map((item) => `${item.command.raw}:${item.action}`)).toEqual([
			"echo $(($(diff <(a)) + 1)):ask",
			"diff <(a):ask",
			"pwd:allow",
		]);
	});

	it("recursively collects parameter expansion commands", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: for testing purposes
		const parameterExpansion = analyzeBashApproval("echo ${name:-$(rm -rf cache)}", {
			defaultAction: "allow",
			rules: {
				"rm *": "deny",
			},
		});

		expect(parameterExpansion.action).toBe("deny");
		expect(parameterExpansion.commands.map((item) => item.command.raw)).toEqual([
			// biome-ignore lint/suspicious/noTemplateCurlyInString: for testing purposes
			"echo ${name:-$(rm -rf cache)}",
			"rm -rf cache",
		]);
	});

	it("walks control-flow, subshell, group, and function bodies", () => {
		const command = [
			"if test -f package.json; then npm run build; else rm -rf dist; fi",
			"for file in $(ls src); do sed -i s/a/b/ file.txt; done",
			"(git status --short)",
			"{ docker compose up api; }",
			"cleanup() { rm -rf tmp; }",
		].join("\n");
		const decision = analyzeBashApproval(command, {
			defaultAction: "allow",
			rules: {
				"rm *": "deny",
				"sed * -i* *": "ask",
				"docker compose *": "ask",
			},
		});

		expect(decision.action).toBe("deny");
		expect(decision.commands.map((item) => `${item.command.raw}:${item.action}`)).toEqual([
			"test -f package.json:allow",
			"npm run build:allow",
			"rm -rf dist:deny",
			"ls src:allow",
			"sed -i s/a/b/ file.txt:ask",
			"git status --short:allow",
			"docker compose up api:ask",
			"rm -rf tmp:deny",
		]);
		expect(decision.denied.map((item) => item.command.raw)).toEqual(["rm -rf dist", "rm -rf tmp"]);
	});

	it("walks while, until, case, and function command bodies", () => {
		const command = [
			"while false; do rm -rf tmp; done",
			"until true; do rm -rf tmp2; done",
			"case x in $(rm -rf pattern)) rm -rf tmp3 ;; esac",
			"function cleanup() { rm -rf tmp4; }",
		].join("\n");
		const decision = analyzeBashApproval(command, {
			defaultAction: "allow",
			rules: {
				"rm *": "deny",
			},
		});

		expect(decision.action).toBe("deny");
		expect(decision.commands.map((item) => `${item.command.raw}:${item.action}`)).toEqual([
			"false:allow",
			"rm -rf tmp:deny",
			"true:allow",
			"rm -rf tmp2:deny",
			"rm -rf pattern:deny",
			"rm -rf tmp3:deny",
			"rm -rf tmp4:deny",
		]);
	});

	it("matches structured head and tail rules", () => {
		const allow = analyzeBashApproval("git status --short", {
			defaultAction: "ask",
			rules: {
				"git status *": "allow",
			},
		});
		const deny = analyzeBashApproval("git push origin main", {
			defaultAction: "allow",
			rules: {
				"git *": "allow",
				"git push *": "deny",
			},
		});

		expect(allow.action).toBe("allow");
		expect(deny.action).toBe("deny");
	});

	it("matches common argument-bearing commands", () => {
		const rules = {
			"docker compose *": "ask",
			"git status *": "allow",
			"grep * *": "allow",
			"npm run * *": "allow",
			"rm -rf *": "deny",
		} as const;

		expect(analyzeBashApproval("git status --short", { rules }).action).toBe("allow");
		expect(analyzeBashApproval("grep -n TODO src/index.ts", { rules }).action).toBe("allow");
		expect(analyzeBashApproval("npm run test -- --watch", { rules }).action).toBe("allow");
		expect(analyzeBashApproval("docker compose up api", { rules }).action).toBe("ask");
		expect(analyzeBashApproval("rm -rf build", { rules }).action).toBe("deny");
	});

	it("matches structured wildcard rules with strict argument ordering", () => {
		const rules = {
			"*": "deny",
			"find * *": "allow",
			"find * -delete*": "ask",
			"git *": "ask",
			"git status* *": "allow",
			"npm run * *": "allow",
			"sed * -i* * *": "ask",
			"sed -n* * *": "allow",
			"sort* *": "allow",
			"sort -o * *": "ask",
		} as const;

		expect(analyzeBashApproval("git status --short", { rules }).action).toBe("allow");
		expect(analyzeBashApproval("git log --oneline", { rules }).action).toBe("ask");
		expect(analyzeBashApproval("npm run build --watch", { rules }).action).toBe("allow");
		expect(analyzeBashApproval("find src -delete", { rules }).action).toBe("ask");
		expect(analyzeBashApproval("find src -print", { rules }).action).toBe("allow");
		expect(analyzeBashApproval("sort -o out.txt in.txt", { rules }).action).toBe("ask");
		expect(analyzeBashApproval("sort --reverse in.txt", { rules }).action).toBe("allow");
		expect(analyzeBashApproval("sed -i.bak s/a/b/ file.txt", { rules }).action).toBe("ask");
		expect(analyzeBashApproval("sed -n 1p file.txt", { rules }).action).toBe("allow");
		expect(analyzeBashApproval("echo hi", { rules }).action).toBe("deny");
	});

	it("does not skip arguments unless the pattern has an explicit wildcard", () => {
		const rules = {
			"rm -rf *": "deny",
		} as const;

		expect(analyzeBashApproval("rm -rf build", { rules }).action).toBe("deny");
		expect(analyzeBashApproval("rm foo -rf build", { defaultAction: "allow", rules }).action).toBe(
			"allow",
		);
		expect(
			analyzeBashApproval("rm foo -rf build", {
				defaultAction: "allow",
				rules: {
					"rm * -rf *": "deny",
				},
			}).action,
		).toBe("deny");
	});

	it("lets single-token patterns match commands with or without args", () => {
		const rules = {
			git: "ask",
			"ls *": "allow",
			lstmeval: "deny",
		} as const;

		expect(analyzeBashApproval("git", { rules }).action).toBe("ask");
		expect(analyzeBashApproval("git status --short", { rules }).action).toBe("ask");
		expect(analyzeBashApproval("ls", { rules }).action).toBe("allow");
		expect(analyzeBashApproval("ls -la", { rules }).action).toBe("allow");
		expect(analyzeBashApproval("lstmeval", { rules }).action).toBe("deny");
	});

	it("defaults dynamic commands to allow when dynamicAction is omitted", () => {
		const decision = analyzeBashApproval("$CMD file", {
			defaultAction: "allow",
			rules: {
				"rm *": "deny",
			},
		});

		expect(decision.action).toBe("allow");
		expect(decision.commands).toHaveLength(1);
		expect(decision.commands[0]?.command.raw).toBe("$CMD file");
		expect(decision.commands[0]?.action).toBe("allow");
	});

	it("uses dynamicAction for dynamic command heads inside pipelines", () => {
		const decision = analyzeBashApproval("$CMD file | grep h", {
			defaultAction: "allow",
			dynamicAction: "ask",
			rules: {
				"grep *": "allow",
			},
		});

		expect(decision.action).toBe("ask");
		expect(decision.commands.map((item) => `${item.command.raw}:${item.action}`)).toEqual([
			"$CMD file:ask",
			"grep h:allow",
		]);
		expect(decision.commands[0]?.command).toMatchObject({
			head: null,
			tail: [],
			staticCommand: false,
		});
	});

	it("keeps each dynamic pipeline command separate", () => {
		const decision = analyzeBashApproval('"$CMD" file | "$FILTER" h', {
			defaultAction: "allow",
			dynamicAction: "ask",
		});

		expect(decision.action).toBe("ask");
		expect(
			decision.commands.map(
				(item) => `${item.command.raw}:${item.command.staticCommand}:${item.action}`,
			),
		).toEqual(['"$CMD" file:false:ask', '"$FILTER" h:false:ask']);
	});

	it("marks commands with dynamic arguments as non-static", () => {
		const decision = analyzeBashApproval('sh -c "$SCRIPT" | cat', {
			defaultAction: "allow",
			dynamicAction: "ask",
			rules: {
				cat: "allow",
			},
		});

		expect(decision.action).toBe("ask");
		expect(decision.commands.map((item) => `${item.command.raw}:${item.action}`)).toEqual([
			'sh -c "$SCRIPT":ask',
			"cat:allow",
		]);
		expect(decision.commands[0]?.command).toMatchObject({
			head: "sh",
			tail: [],
			staticCommand: false,
		});
	});

	it("collects command substitutions used as a dynamic command head", () => {
		const decision = analyzeBashApproval("$(echo rm) -rf build | cat", {
			defaultAction: "allow",
			dynamicAction: "ask",
			rules: {
				cat: "allow",
			},
		});

		expect(decision.action).toBe("ask");
		expect(decision.commands.map((item) => `${item.command.raw}:${item.action}`)).toEqual([
			"$(echo rm) -rf build:ask",
			"echo rm:allow",
			"cat:allow",
		]);
		expect(decision.commands[0]?.command).toMatchObject({
			head: null,
			tail: [],
			staticCommand: false,
		});
	});

	it("does not apply structured tail rules to dynamic arguments", () => {
		const decision = analyzeBashApproval('sed -i s/a/b/ "$file"', {
			defaultAction: "allow",
			dynamicAction: "ask",
			rules: {
				"sed * -i*": "ask",
			},
		});

		expect(decision.action).toBe("ask");
		expect(decision.commands[0]?.command).toMatchObject({
			head: "sed",
			tail: [],
			staticCommand: false,
		});
	});

	it("uses dynamicAction before rules and defaultAction for dynamic commands", () => {
		const ask = analyzeBashApproval("$CMD file", {
			defaultAction: "allow",
			dynamicAction: "ask",
			rules: {
				"*": "deny",
			},
		});
		const deny = analyzeBashApproval("$CMD file", {
			defaultAction: "allow",
			dynamicAction: "deny",
			rules: {
				"*": "allow",
			},
		});
		const fallback = analyzeBashApproval("$CMD file", { defaultAction: "ask" });

		expect(ask.action).toBe("ask");
		expect(ask.commands[0]?.command.staticCommand).toBe(false);
		expect(deny.action).toBe("deny");
		expect(deny.denied.map((item) => item.command.raw)).toEqual(["$CMD file"]);
		expect(fallback.action).toBe("ask");
	});

	it("tracks raw command facts for static and dynamic words", () => {
		const decision = analyzeBashApproval("NAME=value echo 'hello world' \"literal\" $TARGET", {
			defaultAction: "allow",
		});

		expect(decision.commands[0]?.command).toEqual({
			raw: "NAME=value echo 'hello world' \"literal\" $TARGET",
			head: "echo",
			tail: [],
			staticCommand: false,
		});
	});

	it("creates a stable deny error", () => {
		const decision = analyzeBashApproval("rm -rf build", {
			defaultAction: "allow",
			rules: {
				"rm *": "deny",
			},
		});
		const error = new BashApprovalDeniedError(decision);

		expect(error.name).toBe("BashApprovalDeniedError");
		expect(error.message).toContain("rm -rf build");
	});
});
