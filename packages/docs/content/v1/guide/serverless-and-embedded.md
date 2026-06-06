# Serverless and Embedded

AI SDK X is designed for environments where there may be no durable local disk, no long-lived process memory, and no host runtime you want the model to depend on.

The default Bash runtime can still run useful work because JavaScript, Python, and SQLite are backed by WASM-capable runtime commands. That makes it practical to embed agent execution inside Cloudflare Workers, serverless functions, browser-adjacent runtimes, or product sandboxes.

Configure three layers explicitly in serverless code:

- `EnvBackend` for cwd and env persistence.
- `BaseFS` for the runtime's default filesystem.
- Feature filesystems and wrappers for durable mounted storage.

## EnvBackend

`EnvBackend` persists the process-like session state.

```ts
import type { EnvBackend, EnvSnapshot } from "ai-sdk-x";

const envBackend: EnvBackend = {
  async load(): Promise<EnvSnapshot | null> {
    return null;
  },
  async save(snapshot) {
    void snapshot;
  },
};
```

Use `MemoryEnvBackend` for local demos. Use `KvEnvBackend` or your own backend when cwd and env should survive across invocations.

```ts
import { InMemoryKVStore, KvEnvBackend, X } from "ai-sdk-x";

const x = new X({
  envBackend: new KvEnvBackend({
    kv: new InMemoryKVStore(),
    key: "session:env",
  }),
});
```

## BaseFS

The default base filesystem is in-memory.

```ts
import { InMemoryFs, X } from "ai-sdk-x";

const x = new X({
  fs: new InMemoryFs(),
});
```

In serverless environments, passing `fs` explicitly makes the storage boundary clear. `X` wraps it in `BootstrappableMountableFs` so Bash gets a usable runtime layout and features can mount storage.

## FeaturedFS

Features can mount their own filesystems on top of the runtime root.

```ts
import { InMemoryFs, X, createWorkspaceFeature } from "ai-sdk-x";

const workspaceFs = new InMemoryFs();

const x = new X()
  .registerFeature(
    createWorkspaceFeature({
      fs: workspaceFs,
      mountPoint: "/home/user/workspace",
    }),
  );
```

Use this pattern for Workspace, Memory, Skills, or your own feature storage.

## Use FS wrappers

Prefer wrappers when your real backend is remote or persistent:

- `IndexedFs` keeps directory metadata in `KVStorage`.
- `CachingFs` reduces repeated remote reads.
- `TransactionalFs` stages writes before commit.
- `createSubpathFs()` scopes a feature to one path.

```ts
import { CachingFs, IndexedFs, InMemoryKVStore } from "ai-sdk-x";

const kv = new InMemoryKVStore();
const fs = new CachingFs({
  fs: new IndexedFs({ fs: objectStoreFs, cache: kv }),
  cache: kv,
  ttlMs: 30_000,
});
```

The inner `objectStoreFs` can be your own adapter for S3, R2, Blob storage, a database, or another service that can satisfy the filesystem interface.

## Create an FS adapter

To build an adapter, implement the `IFileSystem` interface from `just-bash` and make paths behave like absolute Unix paths.

```ts
import type { IFileSystem } from "ai-sdk-x";

class ObjectStoreFs implements IFileSystem {
  // Implement readFile, writeFile, stat, readdir, mkdir, rm, and the other
  // filesystem operations required by the storage behavior you expose.
}
```

Then pass it as:

- the top-level `fs`
- a feature `fs`
- the inner filesystem wrapped by `IndexedFs`, `CachingFs`, or `TransactionalFs`

Keep the adapter small and let AI SDK X wrappers provide indexing, caching, mounting, and transaction behavior.
