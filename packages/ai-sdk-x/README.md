# AI-SDK-X

<img align="right" src="https://raw.githubusercontent.com/niapya/ai-sdk-x/main/packages/docs/public/logo.svg" width="120" alt="ai-sdk-x logo" />

> Your agent maybe ONLY need this tool.

AI-SDK-X is a **Virtual Bash**.

It brings `bash` tool to the [AI SDK](https://ai-sdk.dev).

Build agents that interact with a real Unix-like shell.

Supports most **Unix commands**, `curl`, `git`, and WASM runtimes for `node` and `python`.

Also includes **Skills**, **Memory**, and **Patch**.

See the [Docs](https://niapya.github.io/ai-sdk-x).

## Quick Start

Install the packages:

```bash
npm install ai-sdk-x ai zod
```

Then, try your agent:

```ts
import { X } from "ai-sdk-x";
import { ToolLoopAgent } from "ai";

const bash = X.init();
const tools = await bash.getTools();

const agent = new ToolLoopAgent({
  model: "gpt-5.5",
  tools,
  stopWhen: stepCountIs(20),
});

await agent.generate({
  prompt: `
    First, search and install "frontend-design" Skills.

    Then, read it and implement a "Snake game" in the Workspace.

    Finally, summarise into Memory.`
});
```
