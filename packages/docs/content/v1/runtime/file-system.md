# File System

AI SDK X puts Bash and features on top of a shared filesystem model.

Every filesystem implements the `IFileSystem` interface from `just-bash`. AI SDK X then composes those implementations with mounts and wrappers.

## Base filesystem

The top-level `fs` option is the base filesystem.

```ts
import { InMemoryFs, X } from "ai-sdk-x";

const x = new X({
  fs: new InMemoryFs(),
});
```

If you do not pass one, AI SDK X uses `InMemoryFs`.

## Built-in filesystems

AI SDK X re-exports the filesystem implementations from Just Bash. Use these as the base filesystem, feature filesystem, or inner filesystem for AI SDK X wrappers.

### InMemoryFs

`InMemoryFs` stores files in process memory. It is the default base filesystem and is useful for tests, demos, isolated agent sessions, and serverless invocations where persistence is handled elsewhere.

```ts
import { InMemoryFs, X } from "ai-sdk-x";

const x = new X({
  fs: new InMemoryFs(),
});
```

### ReadWriteFs

`ReadWriteFs` maps the virtual filesystem to a real local directory. Use it for local development, desktop apps, CLIs, or examples where Bash should read and write host files.

```ts
import { ReadWriteFs, X } from "ai-sdk-x";

const x = new X({
  fs: new ReadWriteFs({
    root: "/Users/alice/project",
  }),
});
```

### OverlayFs

`OverlayFs` is a copy-on-write filesystem backed by a real local directory. Reads come from disk, while writes stay in memory and do not persist to the host directory.

```ts
import { OverlayFs, X } from "ai-sdk-x";

const overlay = new OverlayFs({
  root: "/Users/alice/project",
  mountPoint: "/home/user/project",
});

const x = new X({
  fs: overlay,
});
```

### MountableFs

`MountableFs` mounts filesystems at absolute paths. AI SDK X uses `BootstrappableMountableFs`, a runtime-aware extension of this idea, but `MountableFs` is still useful when you want a general mountable filesystem outside `X`.

```ts
import { InMemoryFs, MountableFs } from "ai-sdk-x";

const fs = new MountableFs({
  base: new InMemoryFs(),
});

fs.mount("/workspace", workspaceFs);
```

## Runtime filesystem

`X` wraps the base filesystem in `BootstrappableMountableFs`.

```ts
import { BootstrappableMountableFs, InMemoryFs } from "ai-sdk-x";

const fs = new BootstrappableMountableFs({
  base: new InMemoryFs(),
});
```

This wrapper preserves Bash bootstrap paths and supports feature mounts.

## Feature filesystems

Features mount storage into the runtime root.

```ts
ctx.fs.mount("/home/user/workspace", workspaceFs);
ctx.setEnv("WORKSPACE_HOME", "/home/user/workspace");
```

Built-in Workspace, Memory, and Skills features accept `fs` and `mountPoint` options for this pattern.

## FS wrappers

Use wrappers to adapt the same filesystem interface to platform storage.

### BootstrappableMountableFs

`BootstrappableMountableFs` is the runtime root used by `X`. It preserves the Bash bootstrap layout and supports mounting feature filesystems.

```ts
import { BootstrappableMountableFs, InMemoryFs } from "ai-sdk-x";

const runtimeFs = new BootstrappableMountableFs({
  base: new InMemoryFs(),
});

runtimeFs.mount("/home/user/workspace", workspaceFs);
```

You usually do not need to construct it yourself because `new X({ fs })` creates it for you.

### createSubpathFs

`createSubpathFs()` exposes one directory as a scoped filesystem. Use it when a feature should see a subtree as its own root.

```ts
import { createSubpathFs } from "ai-sdk-x";

const projectFs = createSubpathFs(runtimeFs, "/home/user/projects/demo");
```

Mount that scoped filesystem into a feature when you want all paths to resolve inside the selected directory.

### IndexedFs

`IndexedFs` keeps directory listings and stat metadata in `KVStorage`. It is useful when the backing filesystem behaves like object storage, where listing directories is expensive or not native.

```ts
import { IndexedFs, InMemoryKVStore } from "ai-sdk-x";

const indexed = new IndexedFs({
  fs: objectStoreFs,
  cache: new InMemoryKVStore(),
  manifestPrefix: "workspace:index",
});
```

File contents still come from the wrapped filesystem. Directory metadata comes from the index.

### CachingFs

`CachingFs` caches file reads, stat results, and directory listings in `KVStorage`. Use it in front of remote or high-latency filesystems.

```ts
import { CachingFs, InMemoryKVStore } from "ai-sdk-x";

const cached = new CachingFs({
  fs: indexed,
  cache: new InMemoryKVStore(),
  ttlMs: 60_000,
});
```

Writes invalidate affected cache entries so later reads do not keep stale metadata.

### TransactionalFs

`TransactionalFs` stages mutations before they are committed to the wrapped filesystem. Use it when an agent should prepare edits, inspect them, then either commit or rollback.

```ts
import { TransactionalFs } from "ai-sdk-x";

const tx = new TransactionalFs({
  fs: cached,
});

await tx.writeFile("/draft.md", "draft");
await tx.commit();
```

Call `rollback()` instead of `commit()` when validation fails.

### Compose wrappers

Wrappers can be composed before mounting them into a feature.

```ts
const fs = new TransactionalFs({
  fs: new CachingFs({
    fs: new IndexedFs({ fs: objectStoreFs, cache: kv }),
    cache: kv,
    ttlMs: 60_000,
  }),
});
```

## Custom filesystem

To build your own filesystem or wrapper, implement `IFileSystem`. If you are adapting a new backend such as S3, R2, Blob storage, or a database, map absolute Unix paths to that backend. If you are wrapping an existing filesystem, delegate to the inner filesystem and add behavior such as access control, audit logging, path policy, encryption, validation, caching, or metadata synchronization.

After that, pass it as the top-level `fs`, a feature `fs`, or the inner filesystem of one of the built-in wrappers.
