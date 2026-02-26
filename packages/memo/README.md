# @ai-sdk-x/memo

Memoize 用于缓存一个 AI SDK 工具的执行结果。

如果您的工具是一个纯函数，并且在短时间内被频繁调用，那么使用 Memo 包可以帮您缓存工具的执行结果，从而提高性能。

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
