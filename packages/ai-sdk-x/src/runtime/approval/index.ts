import {
	type CommandNode,
	type PipelineNode,
	parse,
	type ScriptNode,
	type SimpleCommandNode,
	type StatementNode,
	serialize,
	type WordNode,
} from "just-bash";

type WordPart = WordNode["parts"][number];

export type ApprovalAction = "allow" | "ask" | "deny";

/**
 * Command-level approval policy for the Bash tool returned by `getTools()`.
 *
 * Policy order:
 * 1. If `approval` is omitted, Bash tool calls are allowed without approval.
 * 2. Dynamic commands use `dynamicAction ?? defaultAction ?? "allow"`.
 * 3. Static commands use the last matching entry from `rules`.
 * 4. Unmatched static commands use `defaultAction ?? "allow"`.
 *
 * Dynamic commands include parse failures, unsupported Bash syntax, dynamic command
 * heads such as `$CMD file`, and commands with dynamic arguments such as
 * `sh -c "$SCRIPT"`.
 */
export interface BashApprovalOptions {
	/**
	 * Static command rules keyed by structured command patterns.
	 *
	 * The first token matches the command head. Remaining tokens match arguments
	 * in order; `*` may consume zero or more argument tokens.
	 * Later matching rules win after patterns are sorted from shorter to longer.
	 */
	rules?: Record<string, ApprovalAction>;
	/**
	 * Fallback action for static commands that do not match any rule.
	 *
	 * Also used as the fallback for dynamic commands when `dynamicAction` is omitted.
	 * Defaults to `"allow"`.
	 */
	defaultAction?: ApprovalAction;
	/**
	 * Action for dynamic or partially unanalyzable commands.
	 *
	 * This is checked before `rules` because dynamic commands do not have reliable
	 * static `head` and `tail` facts. Defaults to `defaultAction ?? "allow"`.
	 */
	dynamicAction?: ApprovalAction;
}

export interface ApprovalCommand {
	raw: string;
	head: string | null;
	tail: string[];
	staticCommand: boolean;
}

export interface ApprovalCommandDecision {
	action: ApprovalAction;
	command: ApprovalCommand;
	pattern: string;
}

export interface ApprovalDecision {
	action: ApprovalAction;
	commands: ApprovalCommandDecision[];
	denied: ApprovalCommandDecision[];
}

const ACTION_RANK: Record<ApprovalAction, number> = {
	allow: 0,
	ask: 1,
	deny: 2,
};

export class BashApprovalDeniedError extends Error {
	readonly decision: ApprovalDecision;

	constructor(decision: ApprovalDecision) {
		const deniedCommands = decision.denied
			.map((item) => `${item.command.raw} (${item.pattern}: ${item.action})`)
			.join(", ");
		super(`Bash command denied by approval rules: ${deniedCommands}`);
		this.name = "BashApprovalDeniedError";
		this.decision = decision;
	}
}

export function analyzeBashApproval(
	command: string,
	options: BashApprovalOptions = {},
): ApprovalDecision {
	try {
		const ast = parse(command);
		const commands = collectApprovalCommands(ast);
		const decisions = commands.map((item) => evaluateCommand(item, options));
		const action = foldActions(decisions.map((item) => item.action));

		return {
			action,
			commands: decisions,
			denied: decisions.filter((item) => item.action === "deny"),
		};
	} catch {
		const decision = evaluateCommand(dynamicCommand(command), options);
		return {
			action: decision.action,
			commands: [decision],
			denied: decision.action === "deny" ? [decision] : [],
		};
	}
}

export function collectApprovalCommands(ast: ScriptNode): ApprovalCommand[] {
	const commands: ApprovalCommand[] = [];
	walkScript(ast, commands);
	return commands;
}

function evaluateCommand(
	command: ApprovalCommand,
	options: BashApprovalOptions,
): ApprovalCommandDecision {
	const entries = Object.entries(options.rules ?? {}).sort(([left], [right]) => {
		const byLength = left.length - right.length;
		return byLength !== 0 ? byLength : left.localeCompare(right);
	});

	if (!command.staticCommand) {
		return {
			action: options.dynamicAction ?? options.defaultAction ?? "allow",
			command,
			pattern: "*",
		};
	}

	let action: ApprovalAction | undefined;
	let pattern: string | undefined;

	for (const [candidatePattern, candidateAction] of entries) {
		if (!matchesRule(command, candidatePattern)) continue;
		action = candidateAction;
		pattern = candidatePattern;
	}

	if (action !== undefined) {
		return {
			action,
			command,
			pattern: pattern ?? "*",
		};
	}

	return {
		action: options.defaultAction ?? "allow",
		command,
		pattern: pattern ?? "*",
	};
}

function foldActions(actions: ApprovalAction[]): ApprovalAction {
	return actions.reduce<ApprovalAction>(
		(worst, action) => (ACTION_RANK[action] > ACTION_RANK[worst] ? action : worst),
		"allow",
	);
}

function matchesRule(command: ApprovalCommand, pattern: string): boolean {
	if (!command.head) return false;

	const parts = pattern.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return false;
	if (!wildcardMatch(command.head, parts[0])) return false;
	if (parts.length === 1) return true;
	return matchSequence(command.tail, parts.slice(1));
}

function matchSequence(items: string[], patterns: string[]): boolean {
	if (patterns.length === 0) return items.length === 0;
	const [pattern, ...rest] = patterns;
	if (pattern === "*") {
		for (let i = 0; i <= items.length; i++) {
			if (matchSequence(items.slice(i), rest)) return true;
		}
		return false;
	}

	if (items.length === 0) return false;
	return wildcardMatch(items[0], pattern) && matchSequence(items.slice(1), rest);
}

function wildcardMatch(input: string, pattern: string): boolean {
	const normalizedInput = input.replaceAll("\\", "/");
	const normalizedPattern = pattern.replaceAll("\\", "/");
	const escaped = normalizedPattern
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*")
		.replace(/\?/g, ".");

	return new RegExp(`^${escaped}$`, "s").test(normalizedInput);
}

function walkScript(node: ScriptNode, commands: ApprovalCommand[]): void {
	for (const statement of node.statements) {
		walkStatement(statement, commands);
	}
}

function walkStatement(node: StatementNode, commands: ApprovalCommand[]): void {
	for (const pipeline of node.pipelines) {
		walkPipeline(pipeline, commands);
	}
}

function walkPipeline(node: PipelineNode, commands: ApprovalCommand[]): void {
	for (const command of node.commands) {
		walkCommand(command, commands);
	}
}

function walkCommand(node: CommandNode, commands: ApprovalCommand[]): void {
	switch (node.type) {
		case "SimpleCommand":
			commands.push(commandFact(node));
			walkSimpleCommandWordParts(node, commands);
			break;
		case "If":
			for (const clause of node.clauses) {
				for (const statement of clause.condition) walkStatement(statement, commands);
				for (const statement of clause.body) walkStatement(statement, commands);
			}
			if (node.elseBody) {
				for (const statement of node.elseBody) walkStatement(statement, commands);
			}
			break;
		case "For":
			if (node.words) {
				for (const word of node.words) walkWordParts(word.parts, commands);
			}
			for (const statement of node.body) walkStatement(statement, commands);
			break;
		case "CStyleFor":
			for (const statement of node.body) walkStatement(statement, commands);
			break;
		case "While":
		case "Until":
			for (const statement of node.condition) walkStatement(statement, commands);
			for (const statement of node.body) walkStatement(statement, commands);
			break;
		case "Case":
			walkWordParts(node.word.parts, commands);
			for (const item of node.items) {
				for (const pattern of item.patterns) walkWordParts(pattern.parts, commands);
				for (const statement of item.body) walkStatement(statement, commands);
			}
			break;
		case "Subshell":
		case "Group":
			for (const statement of node.body) walkStatement(statement, commands);
			break;
		case "ArithmeticCommand":
			walkArithExpr(node.expression.expression, commands);
			break;
		case "ConditionalCommand":
			walkConditionalExpr(node.expression, commands);
			break;
		case "FunctionDef":
			walkCommand(node.body, commands);
			break;
	}
}

function commandFact(node: SimpleCommandNode): ApprovalCommand {
	const words = [node.name, ...node.args].filter((word): word is WordNode => word !== null);
	const [headWord, ...tailWords] = words;
	const head = headWord ? staticWord(headWord) : null;
	const tail = tailWords.map(staticWord);
	const staticCommand = head !== null && tail.every((item): item is string => item !== null);

	return {
		raw: serializeSimpleCommand(node),
		head,
		tail: staticCommand ? tail : [],
		staticCommand,
	};
}

function dynamicCommand(raw: string): ApprovalCommand {
	return {
		raw,
		head: null,
		tail: [],
		staticCommand: false,
	};
}

function serializeSimpleCommand(node: SimpleCommandNode): string {
	return serialize({
		type: "Script",
		statements: [
			{
				type: "Statement",
				pipelines: [
					{
						type: "Pipeline",
						commands: [node],
						negated: false,
					},
				],
				operators: [],
				background: false,
			},
		],
	}).trim();
}

function staticWord(word: WordNode): string | null {
	let out = "";
	for (const part of word.parts) {
		const value = staticWordPart(part);
		if (value === null) return null;
		out += value;
	}
	return out;
}

function staticWordPart(part: WordPart): string | null {
	const maybePart = part as
		| { type: "Literal"; value: string }
		| { type: "SingleQuoted"; value: string }
		| { type: "Escaped"; value: string }
		| { type: "TildeExpansion"; user: string | null }
		| { type: "DoubleQuoted"; parts: WordPart[] };

	switch (maybePart.type) {
		case "Literal":
		case "SingleQuoted":
		case "Escaped":
			return maybePart.value;
		case "TildeExpansion":
			return maybePart.user === null ? "~" : `~${maybePart.user}`;
		case "DoubleQuoted": {
			let out = "";
			for (const child of maybePart.parts) {
				const value = staticWordPart(child);
				if (value === null) return null;
				out += value;
			}
			return out;
		}
		default:
			return null;
	}
}

function walkSimpleCommandWordParts(node: SimpleCommandNode, commands: ApprovalCommand[]): void {
	if (node.name) walkWordParts(node.name.parts, commands);
	for (const arg of node.args) walkWordParts(arg.parts, commands);
	for (const assignment of node.assignments) {
		if (assignment.value) walkWordParts(assignment.value.parts, commands);
		if (assignment.array) {
			for (const word of assignment.array) walkWordParts(word.parts, commands);
		}
	}
	for (const redirection of node.redirections) {
		if (redirection.target.type === "HereDoc") {
			walkWordParts(redirection.target.content.parts, commands);
		} else {
			walkWordParts(redirection.target.parts, commands);
		}
	}
}

function walkWordParts(parts: WordPart[], commands: ApprovalCommand[]): void {
	for (const part of parts) {
		switch (part.type) {
			case "CommandSubstitution":
			case "ProcessSubstitution":
				walkScript(part.body, commands);
				break;
			case "DoubleQuoted":
				walkWordParts(part.parts, commands);
				break;
			case "ParameterExpansion":
				if (part.operation) walkParameterOp(part.operation, commands);
				break;
			case "BraceExpansion":
				for (const item of part.items) {
					if (item.type === "Word") walkWordParts(item.word.parts, commands);
				}
				break;
			case "ArithmeticExpansion":
				walkArithExpr(part.expression.expression, commands);
				break;
			case "Glob":
			case "TildeExpansion":
			case "Literal":
			case "SingleQuoted":
			case "Escaped":
				break;
		}
	}
}

function walkParameterOp(
	op: NonNullable<Extract<WordNode["parts"][number], { type: "ParameterExpansion" }>["operation"]>,
	commands: ApprovalCommand[],
): void {
	switch (op.type) {
		case "DefaultValue":
		case "AssignDefault":
		case "UseAlternative":
			walkWordParts(op.word.parts, commands);
			break;
		case "ErrorIfUnset":
			if (op.word) walkWordParts(op.word.parts, commands);
			break;
		case "PatternRemoval":
			walkWordParts(op.pattern.parts, commands);
			break;
		case "PatternReplacement":
			walkWordParts(op.pattern.parts, commands);
			if (op.replacement) walkWordParts(op.replacement.parts, commands);
			break;
		case "CaseModification":
			if (op.pattern) walkWordParts(op.pattern.parts, commands);
			break;
		case "Indirection":
			if (op.innerOp) walkParameterOp(op.innerOp, commands);
			break;
	}
}

function walkConditionalExpr(
	expr: Extract<CommandNode, { type: "ConditionalCommand" }>["expression"],
	commands: ApprovalCommand[],
): void {
	switch (expr.type) {
		case "CondWord":
			walkWordParts(expr.word.parts, commands);
			break;
		case "CondUnary":
			walkWordParts(expr.operand.parts, commands);
			break;
		case "CondBinary":
			walkWordParts(expr.left.parts, commands);
			walkWordParts(expr.right.parts, commands);
			break;
		case "CondNot":
			walkConditionalExpr(expr.operand, commands);
			break;
		case "CondAnd":
		case "CondOr":
			walkConditionalExpr(expr.left, commands);
			walkConditionalExpr(expr.right, commands);
			break;
		case "CondGroup":
			walkConditionalExpr(expr.expression, commands);
			break;
	}
}

function walkArithExpr(
	expr: Extract<CommandNode, { type: "ArithmeticCommand" }>["expression"]["expression"],
	commands: ApprovalCommand[],
): void {
	switch (expr.type) {
		case "ArithCommandSubst":
			try {
				walkScript(parse(expr.command), commands);
			} catch {
				commands.push(dynamicCommand(expr.command));
			}
			break;
		case "ArithBinary":
			walkArithExpr(expr.left, commands);
			walkArithExpr(expr.right, commands);
			break;
		case "ArithUnary":
			walkArithExpr(expr.operand, commands);
			break;
		case "ArithTernary":
			walkArithExpr(expr.condition, commands);
			walkArithExpr(expr.consequent, commands);
			walkArithExpr(expr.alternate, commands);
			break;
		case "ArithAssignment":
		case "ArithDynamicAssignment":
			walkArithExpr(expr.value, commands);
			if ("subscript" in expr && expr.subscript) walkArithExpr(expr.subscript, commands);
			if ("target" in expr) walkArithExpr(expr.target, commands);
			break;
		case "ArithDynamicElement":
			walkArithExpr(expr.nameExpr, commands);
			walkArithExpr(expr.subscript, commands);
			break;
		case "ArithGroup":
		case "ArithNested":
			walkArithExpr(expr.expression, commands);
			break;
		case "ArithArrayElement":
			if (expr.index) walkArithExpr(expr.index, commands);
			break;
		case "ArithDoubleSubscript":
			walkArithExpr(expr.index, commands);
			break;
		case "ArithNumberSubscript":
			break;
		case "ArithConcat":
			for (const part of expr.parts) walkArithExpr(part, commands);
			break;
		case "ArithBracedExpansion":
		case "ArithDynamicBase":
		case "ArithDynamicNumber":
		case "ArithNumber":
		case "ArithVariable":
		case "ArithSpecialVar":
		case "ArithSyntaxError":
		case "ArithSingleQuote":
			break;
	}
}
