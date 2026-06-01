# Backend Storage

AI SDK X uses `KVStorage` as the smallest persistence primitive for runtime wrappers.

That makes storage easy to swap without changing the rest of the runtime design.

## KV interface

```ts
interface KVStorage {
  list(prefix?: string, limit?: number): string[] | Promise<string[]>;
  get(key: string): string | null | undefined | Promise<string | null | undefined>;
  set(key: string, value: string, ttl?: number): void | Promise<void>;
  delete(key: string): void | Promise<void>;
}
```

The contract is intentionally minimal:

- `get` and `set` store string values.
- `list` supports prefix scans and optional caps.
- `ttl` is available when the backend supports expiration.

## Default implementation

`InMemoryKVStore` is the default backend used by runtime wrappers.

```ts
import { InMemoryKVStore } from "ai-sdk-x";

const kv = new InMemoryKVStore({
  now: () => Date.now(),
});

await kv.set("answer", "42", 10_000);
console.log(await kv.get("answer"));
```

It is a good fit for:

- tests,
- local demos,
- and ephemeral runtimes.

## What runtime layers store here

Storage is used by several runtime wrappers:

- env snapshots
- filesystem indexes
- filesystem caches

That means one backend can serve multiple runtime concerns as long as the key space is separated.

## Cache and index linkage

If you want your KV cache to survive process restarts, pass the same persistent `KVStorage` implementation into the wrappers that support it.

Examples:

- `KvEnvBackend` stores env snapshots as JSON.
- `IndexedFs` stores directory manifests and child indexes.
- `CachingFs` stores read-through file, stat, and directory cache entries.

This is the main place to plug in Redis, cloud KV, or a custom object store adapter.

## When to customize

Write your own `KVStorage` when you need:

- stronger durability guarantees,
- shared cache state across workers,
- or a backend that maps to an existing platform store.
