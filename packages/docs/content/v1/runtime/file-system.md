# File System

AI SDK X puts Bash and features on top of a shared filesystem model.

That filesystem layer is not just storage. It is the place where the runtime mounts workspaces, isolates paths, stages edits, caches reads, and adapts to backends that do not look like a local disk.

## The core idea

All of the wrappers below implement the same filesystem interface. That lets you compose them:

- mount one filesystem into another
- expose only a subdirectory to a feature
- stage changes before commit
- add a cache in front of a remote backend
- keep directory metadata in KV when listing is expensive

## Bootstrappable mountable FS

`BootstrappableMountableFs` is the runtime filesystem used by `X`.

It preserves the bootstrap behavior that `just-bash` expects for `/bin`, `/dev`, `/proc`, `/tmp`, and the default home directory, while still letting you mount custom filesystems.

### What it is for

Use it when you want:

- one shared runtime filesystem for Bash and features
- mounted workspaces or mounted feature storage
- the default shell bootstrap layout to exist at startup

### How to construct it

`X` creates it for you, but you can also instantiate it directly:

```ts
import { BootstrappableMountableFs } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const fs = new BootstrappableMountableFs({
  base: new InMemoryFs(),
});
```

### Example

```ts
import { BootstrappableMountableFs } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const base = new InMemoryFs();
const fs = new BootstrappableMountableFs({ base });

await fs.mkdir("/workspace", { recursive: true });
await fs.writeFile("/workspace/README.md", "# Demo\n");
```

## Transactional FS

`TransactionalFs` stages file changes in memory until you commit them to the backing filesystem.

### What it is for

Use it when you want to:

- prepare edits without immediately persisting them
- inspect staged changes before applying them
- rollback if validation fails
- keep write-heavy agent workflows controlled

### How to construct it

```ts
import { TransactionalFs } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const tx = new TransactionalFs({
  fs: new InMemoryFs(),
});
```

### Example

```ts
import { TransactionalFs } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const tx = new TransactionalFs({ fs: new InMemoryFs() });

await tx.writeFile("/draft.md", "draft");
console.log(await tx.stat("/draft.md"));

await tx.commit();
```

If you decide not to keep the changes, use `rollback()` instead of `commit()`.

## Subpath FS

`createSubpathFs()` exposes a directory as if it were its own filesystem.

### What it is for

Use it when you want:

- a feature to see only a project root
- mounted content to stay inside a scoped directory
- path resolution to stay inside a known subtree

### How to construct it

```ts
import { createSubpathFs } from "ai-sdk-x";

const scopedFs = createSubpathFs(baseFs, "/home/user/workspace");
```

### Example

```ts
import { createSubpathFs } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const base = new InMemoryFs();
await base.mkdir("/projects/demo", { recursive: true });
await base.writeFile("/projects/demo/README.md", "hello");

const demoFs = createSubpathFs(base, "/projects/demo");

console.log(await demoFs.readFile("/README.md"));
```

## Indexed FS

`IndexedFs` keeps directory listings and stat data in `KVStorage` instead of discovering them by walking the backing filesystem.

### What it is for

Use it when your storage backend behaves more like object storage than a local disk:

- directory walking is expensive
- listings need to come from an index
- you still want file contents to stream from the wrapped filesystem

### How to construct it

```ts
import { IndexedFs, InMemoryKVStore } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const fs = new IndexedFs({
  fs: new InMemoryFs(),
  cache: new InMemoryKVStore(),
  manifestPrefix: "runtime-storage:index",
});
```

### Example

```ts
import { IndexedFs, InMemoryKVStore } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const source = new InMemoryFs();
const cache = new InMemoryKVStore();
const fs = new IndexedFs({
  fs: source,
  cache,
});

await fs.mkdir("/docs", { recursive: true });
await fs.writeFile("/docs/index.md", "# Docs\n");

console.log(await fs.readdir("/docs"));
```

## Caching FS

`CachingFs` is a read-through cache for file contents and directory metadata.

### What it is for

Use it when you want to:

- reduce repeated remote reads
- cache file, stat, and directory lookups
- invalidate read data when writes happen

### How to construct it

```ts
import { CachingFs, InMemoryKVStore } from "ai-sdk-x";

const cachedFs = new CachingFs({
  fs: baseFs,
  cache: new InMemoryKVStore(),
  ttlMs: 30_000,
});
```

### Example

```ts
import { CachingFs, InMemoryKVStore } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const cached = new CachingFs({
  fs: new InMemoryFs(),
  cache: new InMemoryKVStore(),
  ttlMs: 60_000,
});

console.log(await cached.readFile("/README.md"));
```

## Choosing a wrapper

Pick the wrapper that matches the problem:

- `BootstrappableMountableFs` for the shared runtime root
- `TransactionalFs` for staged changes
- `createSubpathFs()` for path isolation
- `IndexedFs` for manifest-backed storage
- `CachingFs` for read-heavy backends

They are all composable, so you can layer them when one wrapper is not enough.
