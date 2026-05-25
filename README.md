# AI-SDK-X

![AI-SDK-X Logo](packages/docs/public/logo.svg)

> Your agent maybe only need this tool.

## Quick Start

First, install the packages.

```bash
npm install ai-sdk-x ai zod
```

Then, try your agent.

```ts
import { X } from "ai-sdk-x";
import { ToolLoopAgent } from "ai";

const bash = new X();
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

	Finally, summarise into Memory.`
});
```