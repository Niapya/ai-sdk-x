# @ai-sdk-x/skill

An auxiliary context tool.

Primarily designed for **Serverless** environments that rely on external storage backends as the backing cache.

> [!NOTE]
> If you are building an agent locally or on a server, the standard approach is to use bash + prompt.

## Installation

```bash
npm add @ai-sdk-x/skill
```

## Overview

Most serverless environments have no persistent filesystem. `@ai-sdk-x/skill` lets you:

1. **Download** skills from Git repositories into any storage backend (S3, R2, KV…)
2. **List / Get** skills at runtime and inject them into your agent's context
3. **Store skills in a database** — use `isomorphic-git` to clone, then recursively persist files. Convert non-text files to Markdown (e.g. via `env.AI.toMarkdown()` on Cloudflare Workers).

## Example: S3 Storage

See the [S3 example](https://github.com/niapya/ai-sdk-x/blob/main/packages/skill/src/examples/s3.ts) on GitHub.