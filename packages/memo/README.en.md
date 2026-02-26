# @ai-sdk-x/memo

Memo is used to cache the execution results of an AI SDK tool.

If your tool is a pure function and is called frequently in a short period of time, using the Memo package can help you cache the tool's execution results, thereby improving performance.

## Usage

```ts
import { createMemo } from "@ai-sdk-x/memo";
import { createStorage } from "unstorage";
import lruCacheDriver from "unstorage/drivers/lru-cache";

const memo = createMemo({
  storage: createStorage({ driver: lruCacheDriver({}) }),
  ttl: 60_000,
});

const memoizedTool = memo(myTool, "myTool");
```

## Examples

For details, see the examples for [memory storage](./src/examples/memory-driver.ts) and [no storage](./src/examples/null-driver.ts).
