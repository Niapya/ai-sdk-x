# Use with AI SDK

Use `getTools()` when you want to pass the AI SDK X Bash tool to a model.

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { X } from "ai-sdk-x";

const x = X.init({
  bash: {
    cwd: "/home/user/workspace",
    network: false,
  },
});

const tools = await x.getTools();

const result = await generateText({
  model: openai("gpt-4.1"),
  tools,
  prompt: "Create a README with a short project description.",
});

console.log(result.text);
```


The tool calls `x.exec()` internally, so Bash commands use the same runtime state as direct `x.exec()` calls.

## Use the description in a system prompt

Some model providers work better when the long Bash description is in the system prompt instead of the tool metadata.

```ts
const system = await x.createToolDescription();
const tools = await x.getTools({ enableDescription: false });

const result = await generateText({
  model: openai("gpt-4.1"),
  system,
  tools,
  prompt: "Inspect the workspace and summarize it.",
});
```

When `enableDescription` is `false`, the Bash tool still works, but its metadata uses a short fallback description.

This is useful when you want to keep the tool schema compact and move the detailed runtime guidance into your system prompt.

## Add external instructions

```ts
const tools = await x.getTools({
  externalDescription:
    "Before making durable edits, inspect the target file with targeted commands.",
  maxLines: 400,
  maxOutput: 20_000,
});
```

Use `externalDescription` for application-specific Bash rules. Use `maxLines` and `maxOutput` to limit tool output.
