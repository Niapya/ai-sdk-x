# Quick Start

`X.init()` is the convenient static constructor for AI SDK X.

It creates a Bash runtime with the default features already registered. Networking is on by default, JavaScript and Python are available through WASM-backed commands, and SQLite is available inside the Bash environment.

## Install

```bash
$ bun add ai-sdk-x ai zod
```

## Create the runtime

```ts
import { X } from "ai-sdk-x";

const x = X.init();
```

This one line gives the agent:

- A virtual Bash with common Unix commands and shell pipes.
- Network access with commands such as `curl` and helpers such as `html-to-markdown`.
- JavaScript and TypeScript execution through `js-exec`.
- Python execution through `python` or `python3`.
- SQLite usage through the Bash runtime.
- Built-in Patch, Git, Workspace, Skills, and Memory features.

## Run a minimal agent

```ts
import { ToolLoopAgent, stepCountIs } from "ai";
import { X } from "ai-sdk-x";

const x = X.init();
const tools = await x.getTools();

const agent = new ToolLoopAgent({
  model: "gpt-5.5",
  tools,
  stopWhen: stepCountIs(20),
});

await agent.generate({
  prompt: `
    First, search and install "frontend-design" Skills.

    Then, read it and implement a "Snake game" in the Workspace.

    Finally, summarise into Memory.
  `,
});
```

## Configure network

Network access is enabled unless you disable it.

```ts
const online = X.init();

const offline = X.init({
  bash: {
    network: false,
  },
});
```

Use `network: false` when the agent should only inspect local or mounted state.

## Configure the base filesystem

By default, AI SDK X uses an in-memory base filesystem. Pass `fs` when your application wants to own the storage.

```ts
import { InMemoryFs, X } from "ai-sdk-x";

const fs = new InMemoryFs();

const x = X.init({
  fs,
  bash: {
    cwd: "/home/user/workspace",
  },
});
```

`X` wraps that base filesystem in `BootstrappableMountableFs`, so Bash gets the expected runtime layout and features can mount additional filesystems.

## Run commands directly

You can use AI SDK X without a model loop.

```ts
const result = await x.exec("pwd && ls -la");

console.log(result.stdout);
console.error(result.stderr);
```

Direct execution uses the same runtime state as tool calls. The persisted cwd and environment snapshot are loaded before each command and saved after it finishes.

## Export AI SDK tools

Use `getTools()` when the model should call Bash.

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
  prompt: "Inspect the workspace and create a short README.",
});

console.log(result.text);
```

`getTools()` returns one Bash tool. Its generated description explains the active runtime, enabled feature commands, mounted paths, network support, and JS/Python availability.
