# Getting Started

AI SDK X is a collection of environment-agnostic agent tool packages built on top of [AI SDK](https://sdk.vercel.ai/). Whether you are running on localhost, a server, or a fully serverless platform, AI SDK X provides the primitives you need to build powerful agents.

## Installation

Install all packages at once via the umbrella package:

```bash
# npm
npm install ai-sdk-x

# bun
bun add ai-sdk-x

# pnpm
pnpm add ai-sdk-x

# yarn
yarn add ai-sdk-x

# Deno
deno add npm:ai-sdk-x
```

Or install individual packages:

```bash
npm add @ai-sdk-x/execute @ai-sdk-x/memo @ai-sdk-x/memory @ai-sdk-x/skill
```

## Packages

| Package | Description |
| --- | --- |
| [`@ai-sdk-x/execute`](/packages/execute) | Execute code across different serverless environments |
| [`@ai-sdk-x/memo`](/packages/memo) | Cache tool execution results to improve performance |
| [`@ai-sdk-x/memory`](/packages/memory) | Add scoped persistent memory to agents |
| [`@ai-sdk-x/skill`](/packages/skill) | Load and manage agent skills from Git repos |

## Peer Dependencies

```bash
npm add ai zod
```

## License

MIT License.
