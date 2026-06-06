# Backend Storage

`KVStorage` is the smallest persistence primitive in AI SDK X.

It is used by env backends and filesystem wrappers when state should live outside process memory.

## Interface

```ts
interface KVStorage {
  list(prefix?: string, limit?: number): string[] | Promise<string[]>;
  get(key: string): string | null | undefined | Promise<string | null | undefined>;
  set(key: string, value: string, ttl?: number): void | Promise<void>;
  delete(key: string): void | Promise<void>;
}
```

The interface intentionally stores strings. Wrappers decide how to serialize their own metadata.

## Default backend

```ts
import { InMemoryKVStore } from "ai-sdk-x";

const kv = new InMemoryKVStore();

await kv.set("answer", "42");
console.log(await kv.get("answer"));
```

`InMemoryKVStore` is useful for tests, local demos, and ephemeral runtimes.

## What uses KVStorage

Built-in runtime layers use KV for:

- `KvEnvBackend` env snapshots
- `IndexedFs` directory manifests
- `CachingFs` read-through cache entries
- `TransactionalFs` status/cache metadata

Use separate prefixes or keys when multiple runtime layers share one persistent backend.

## Custom backend

Implement `KVStorage` for Redis, Cloudflare KV, D1-adjacent metadata, object-store sidecars, or any platform store that can read and write string values.

```ts
const kv: KVStorage = {
  async list(prefix = "") {
    return [];
  },
  async get(key) {
    return null;
  },
  async set(key, value, ttl) {
    void key;
    void value;
    void ttl;
  },
  async delete(key) {
    void key;
  },
};
```

After that, pass it to env backends or FS wrappers.

