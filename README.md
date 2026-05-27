<div align="center">
  <img src="packages/docs/public/logo.svg" width="80" alt="ai-sdk-x logo" />

  <h1>AI-SDK-X</h1>

<a href="https://npmjs.org/package/ai-sdk-x">
    <img src="https://img.shields.io/npm/v/ai-sdk-x.svg" alt="npm version" />
  </a>
  <a href="https://npmjs.org/package/ai-sdk-x">
    <img src="https://img.shields.io/npm/dm/ai-sdk-x.svg" alt="npm downloads" />
  </a>
  <a href="https://github.com/Niapya/ai-sdk-x/blob/main/LICENSE">
    <img src="https://img.shields.io/npm/l/ai-sdk-x.svg" alt="license" />
  </a>
  <a href="https://github.com/Niapya/ai-sdk-x">
    <img src="https://img.shields.io/github/stars/Niapya/ai-sdk-x?style=social" alt="GitHub stars" />
</a>

  <p><strong>Your agent maybe only need this tool.</strong></p>

  <p>
    AI-SDK-X creates a virtual Bash for AI SDK, empowering you to build powerful
    AI agents.
  </p>

  <a href="#-documentation">Docs</a> · <a href="https://github.com/Niapya/ai-sdk-x/issues">Issues</a>

  <br/>
</div>

![AI-SDK-X Demo](./image.jpg)

---

AI-SDK-X creates a **virtual Bash** for the [AI SDK](https://ai-sdk.dev), making it
trivially easy to build agents that can interact with a real Unix-like shell.

It ships with support for most **Unix commands**, **curl**, **git**, and **WASM**-backed runtimes for
**Node.js** and **Python**.

It also bundles first-class commands — **Skills**, **Memory**, and **Patch** —
so your agent can learn, remember, and modify code with minimal setup.

---



## 🚀 Quick Start

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