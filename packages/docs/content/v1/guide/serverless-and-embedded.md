# Serverless and embedded runtimes

AI SDK X can run in environments where you do not have a long-lived local disk, process memory is disposable, or the runtime is embedded inside another app.

The default runtime already includes:

- JavaScript support through `js-exec` powered by WASM
- Python support through `python` powered by WASM
- SQLite support through the same Bash environment

That makes the runtime usable in serverless and embedded setups without depending on Node.js or a host filesystem layout.

By default, `X` uses an in-memory filesystem. In serverless or embedded deployments, that is usually the right starting point, but you should still pass `fs` explicitly when you construct the runtime so the storage choice is obvious in your integration code.

## What to configure

For serverless or embedded environments, configure three pieces explicitly:

1. Your own in-memory filesystem
2. Your own storage backend
3. Your own env backend

That keeps the runtime state inside the platform primitives you control.

## Use an in-memory filesystem

Start with `InMemoryFs` when the platform does not give you a persistent local disk.

```ts
import { InMemoryFs } from "just-bash";
import { X } from "ai-sdk-x";

const fs = new InMemoryFs();

const x = new X({
  fs,
});
```

If you use `X.init()`, pass the same `fs` at the top level:

```ts
import { InMemoryFs } from "just-bash";
import { X } from "ai-sdk-x";

const x = X.init({
  fs: new InMemoryFs(),
  bash: {
    cwd: "/home/user/workspace",
    network: false,
  },
});
```

When you use the static constructor style, keep `fs` explicit for the same reason: it makes the runtime shape clear in serverless code.

If you need a mounted workspace or a dedicated feature filesystem, mount that filesystem into the runtime through your feature hooks.

## Use your own storage backend

Pass a custom `KVStorage` when you want cache and index data to survive across invocations.

```ts
import type { KVStorage } from "ai-sdk-x";

const storage: KVStorage = {
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
  async delete(key) {},
};
```

Use that storage with runtime wrappers such as:

- `KvEnvBackend`
- `IndexedFs`
- `CachingFs`
- `TransactionalFs`

This is the right place to connect Redis, Cloudflare KV, D1-adjacent storage, or any platform cache.

## Use your own env backend

If your runtime should remember cwd and environment state across executions, provide a custom `EnvBackend`.

```ts
import type { EnvBackend, EnvSnapshot } from "ai-sdk-x";

const envBackend: EnvBackend = {
  async load(): Promise<EnvSnapshot | null> {
    return null;
  },
  async save(snapshot: EnvSnapshot): Promise<void> {
    void snapshot;
  },
};
```

That lets you persist session state in platform storage instead of relying on process memory.

For env persistence details, see the [Environment](/v1/runtime/environment) guide.

## Build the runtime

```ts
import { InMemoryFs } from "just-bash";
import { InMemoryKVStore, KvEnvBackend, X } from "ai-sdk-x";

const x = new X({
  fs: new InMemoryFs(),
  envBackend: new KvEnvBackend({
    kv: new InMemoryKVStore(),
    key: "project:env",
  }),
});
```

If you are embedding AI SDK X inside a serverless function, this is the basic shape to start from.

## Add features on top

Mount feature-specific filesystems with hooks when you need durable workspace, memory, or skill storage.

```ts
import { createWorkspaceFeature } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const workspaceFs = new InMemoryFs();

x.registerFeature(
  createWorkspaceFeature({
    fs: workspaceFs,
    mountPoint: "/home/user/workspace",
  }),
);
```

In serverless environments, keep each mount backed by an explicit in-memory or platform-backed store so the runtime stays deterministic.
