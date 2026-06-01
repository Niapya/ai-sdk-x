# @ai-sdk-x/memo

Memoize AI SDK tool execution results. If your tool is a pure function and is called frequently in a short period of time, Memo helps you cache the results to improve performance.

## Installation

```bash
npm add @ai-sdk-x/memo
```

## Usage

```typescript
import { createMemo } from "@ai-sdk-x/memo";
// Provide any storage driver implementation (Redis, S3, filesystem, etc.)
const storage = createYourStorageDriver(/* ... */);

const memo = createMemo({
  storage,
  ttl: 60_000, // 60 seconds
});

const memoizedTool = memo(myTool, "myTool");
```

## Example

See the [In-memory example](https://github.com/niapya/ai-sdk-x/blob/main/packages/memo/src/examples/memory-driver.ts) on GitHub.

See the [Null-memory example](https://github.com/niapya/ai-sdk-x/blob/main/packages/memo/src/examples/null-driver.ts) on GitHub.

## Manual Cache Management

The memoized tool exposes `get`, `update`, and `delete` helpers:

```typescript
// Inspect a cache entry
const entry = await memoizedSearch.get('memo:search:{"query":"TypeScript"}');

// Overwrite a cache entry
await memoizedSearch.update('memo:search:{"query":"TypeScript"}', {
  query: "TypeScript",
  results: ["Updated result"],
});

// Remove a cache entry
await memoizedSearch.delete('memo:search:{"query":"TypeScript"}');
```

## Storage Backends

Any storage driver works — Redis, Cloudflare KV, Deno KV, Vercel KV, filesystem, etc.
