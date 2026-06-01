# Quick start

AI SDK X is a Bash runtime for AI agents. It gives the model a unified virtual Bash with built-in features like `Memory`, `Skills`, `Workspace`, `Patch`, and `Git`, plus WASM-backed JavaScript and Python support.

## Quick start

Install the packages:

```bash
npm install ai-sdk-x ai zod
```

Then, try your agent:

```ts
import { X } from "ai-sdk-x";
import { ToolLoopAgent, stepCountIs } from "ai";

const bash = X.init();
const tools = await bash.getTools();

const agent = ToolLoopAgent({
  model: "gpt-5.5",
  tools,
  stopWhen: stepCountIs(20),
});

await agent.generate({
  prompt: `
    First, search and install "frontend-design" Skills.

    Then, read it and implement a "Snake game" in the Workspace.

    Finally, summarise into Memory.`,
});
```

## What you get

- A standard AI SDK X runtime with these built-in features:
  - Patch
  - Git
  - Workspace
  - Skills
  - Memory
- Default runtime support for:
  - JavaScript through `js-exec` powered by WASM
  - Python through `python` powered by WASM
  - SQLite inside the Bash runtime

## What happens inside

`X.init()` creates the virtual Bash runtime and registers the built-in features. `getTools()` then produces the Bash tool description and exposes a Bash tool that the model can call.

The example agent can then:

- install or inspect Skills
- read or write files in the Workspace
- store durable notes in Memory
- use Patch for structured file edits

## What you can configure

The quickest way to start is `X.init()`, but you can still pass the most common runtime options:

- `bash.cwd` to set the initial working directory
- `bash.network` to disable network access
- `workspace`, `memory`, `skills`, `git`, and `patch` to disable or customize built-in features
- `fs` to provide your own runtime filesystem
- `envBackend` to persist cwd and environment state

## Run commands directly

```ts
const result = await bash.exec("pwd && ls -la");
console.log(result.stdout);
```

Use direct commands when you want to inspect the runtime without involving a model loop.
