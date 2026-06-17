# Use With AI SDK

Use `getTools()` to expose AI SDK X as an AI SDK tool set.

Install AI SDK and Zod first:

```bash
$ npm add ai zod
```

```ts
import { generateText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { X } from "ai-sdk-x";

const x = X.init();
const tools = await x.getTools();

const result = await generateText({
  model: openai("gpt-5.1"),
  tools,
  stopWhen: stepCountIs(20),
  prompt: "Inspect the workspace and summarize what is available.",
});
```

The returned tool calls `x.exec()` internally, so direct execution and model tool calls share the same filesystem, cwd, env backend, commands, and hooks.

## getTools options

```ts
const tools = await x.getTools({
  externalDescription:
    "Before editing files, inspect the target with targeted commands.",
  enableDescription: true,
  needsApproval: ({ command }) => command.includes("rm "),
  maxLines: 400,
  maxOutput: 20_000,
});
```

Options:

- `externalDescription` appends application-specific environment notes to the generated Bash description.
- `enableDescription` controls whether the combined generated description is embedded in tool metadata. When `false`, only environment notes are embedded.
- `needsApproval` asks AI SDK to request approval before Bash executes. Use `true` for every call, or a function to decide from `{ command, cwd, stdin }`.
- `maxLines` limits stdout and stderr by line count before size truncation. When output has more lines, AI SDK X keeps the first `maxLines` lines and appends a truncation hint.
- `maxOutput` limits the combined stdout and stderr character budget after line limiting. If one stream already fits, the other stream is truncated to the remaining budget. If both streams exceed the budget, AI SDK X splits the budget across both and appends truncation hints.

## Split guidance and environment

Some model providers handle long guidance better in the system prompt than in tool metadata, and stable guidance is a better fit for prompt caching.

```ts
const instructions = await x.getInstructions();
const tools = await x.getTools({
  enableDescription: false,
});

const result = await generateText({
  model: openai("gpt-5.1"),
  system: instructions.guidance,
  tools,
  prompt: "Use Bash to inspect the project.",
});
```

When `enableDescription` is `false`, the Bash tool still works, but its metadata uses only the environment part.

## What the instructions contain

`getInstructions()` returns the split instructions that exist at call time:

- `guidance` for stable system prompt rules and feature guidance
- `environment` for runtime state and feature environment notes that change over time

Feature commands are described as shell commands inside Bash, not as separate tools or function calls.
