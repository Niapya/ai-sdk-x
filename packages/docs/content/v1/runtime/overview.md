# Runtime

The runtime has three main state layers:

- Environment state: cwd and process-like environment variables.
- Storage: `KVStorage` for indexes, caches, and persisted snapshots.
- Filesystem: mounted virtual filesystems used by Bash and features.

## Environment

`X` persists cwd and env through an `EnvBackend`.

```ts
interface EnvSnapshot {
  cwd: string;
  env: Record<string, string>;
}

interface EnvBackend {
  load(): EnvSnapshot | null | Promise<EnvSnapshot | null>;
  save(snapshot: EnvSnapshot): void | Promise<void>;
}
```

The default backend is `MemoryEnvBackend`. Use `KvEnvBackend` to persist the snapshot through a `KVStorage`.

```ts
import { KvEnvBackend, InMemoryKVStore, X } from "ai-sdk-x";

const kv = new InMemoryKVStore();
const x = new X({
  envBackend: new KvEnvBackend({
    kv,
    key: "project:env",
  }),
});
```

Feature-owned env values are set with `ctx.setEnv()` in hooks. They are merged into command execution, but they are not persisted as user env after the command finishes.

## Storage

`KVStorage` is the small key-value abstraction used by runtime wrappers.

```ts
interface KVStorage {
  list(prefix?: string, limit?: number): string[] | Promise<string[]>;
  get(key: string): string | null | undefined | Promise<string | null | undefined>;
  set(key: string, value: string, ttl?: number): void | Promise<void>;
  delete(key: string): void | Promise<void>;
}
```

`InMemoryKVStore` is the default implementation.

```ts
import { InMemoryKVStore } from "ai-sdk-x";

const kv = new InMemoryKVStore({
  now: () => Date.now(),
});

await kv.set("answer", "42", 10_000);
console.log(await kv.get("answer"));
```

Use your own `KVStorage` when indexes and caches need to survive process restarts.

## Filesystem

`X` wraps the base filesystem in `BootstrappableMountableFs`. Features and Bash commands share this same main FS.

```ts
import { X } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const x = new X({
  fs: new InMemoryFs(),
});

await x.fs.mkdir("/data", { recursive: true });
await x.exec("ls /data");
```

### Transactional FS

`TransactionalFs` stages writes in an overlay until you call `commit()`.

#### What it does

It lets commands and application code make tentative filesystem changes, inspect the pending status, then either commit or rollback those changes.

#### Constructor

```ts
new TransactionalFs(options: TransactionalFsOptions)

interface TransactionalFsOptions {
  cache?: KVStorage;
  fs: IFileSystem;
  now?: () => Date;
}
```

#### What it is useful for

Use it when an agent should prepare a patch, run checks, and only persist changes after validation.

#### Example

```ts
import { TransactionalFs } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const base = new InMemoryFs();
const tx = new TransactionalFs({ fs: base });

await tx.writeFile("/draft.md", "draft");
console.log(await tx.status());

await tx.commit();
```

Use `rollback()` to discard the overlay:

```ts
await tx.writeFile("/scratch.md", "temporary");
await tx.rollback();
```

### Subpath FS

`createSubpathFs()` creates a view of another filesystem rooted at a subdirectory.

#### What it does

It translates local paths into a configured root path on the wrapped filesystem and prevents local paths from escaping that root.

#### Constructor

```ts
createSubpathFs(fs: IFileSystem, root: string): IFileSystem
```

#### What it is useful for

Use it to mount one directory from a larger filesystem as if it were its own filesystem.

#### Example

```ts
import { createSubpathFs } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const base = new InMemoryFs();
await base.mkdir("/projects/demo", { recursive: true });
await base.writeFile("/projects/demo/README.md", "hello");

const demoFs = createSubpathFs(base, "/projects/demo");

console.log(await demoFs.readFile("/README.md"));
```

### Indexed FS

`IndexedFs` stores directory and stat metadata in `KVStorage`.

#### What it does

It answers directory listings and stat calls from manifest entries while file contents still come from the wrapped filesystem.

#### Constructor

```ts
new IndexedFs(options: IndexedFsOptions)

interface IndexedFsOptions {
  cache?: KVStorage;
  fs: IFileSystem;
  manifestPrefix?: string;
  now?: () => Date;
}
```

#### What it is useful for

Use it for object-storage-like backends where listing directories by walking the source filesystem is slow or unavailable.

#### Example

```ts
import { IndexedFs, InMemoryKVStore } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const source = new InMemoryFs();
const index = new InMemoryKVStore();
const fs = new IndexedFs({
  fs: source,
  cache: index,
  manifestPrefix: "workspace:index",
});

await fs.mkdir("/docs", { recursive: true });
await fs.writeFile("/docs/index.md", "# Docs\n");

console.log(await fs.readdir("/docs"));
```

### Caching FS

`CachingFs` is a read-through cache for filesystem reads.

#### What it does

It caches `readFile`, `readFileBuffer`, `readFileBytes`, `stat`, `readdir`, and `readdirWithFileTypes`. Mutations invalidate affected cache entries.

#### Constructor

```ts
new CachingFs(options: CachingFsOptions)

interface CachingFsOptions {
  cache?: KVStorage;
  fs: IFileSystem;
  maxBytes?: number;
  negativeTtlMs?: number;
  now?: () => number;
  readFileTtlMs?: number;
  readdirTtlMs?: number;
  readdirWithFileTypesTtlMs?: number;
  readFileBufferTtlMs?: number;
  readFileBytesTtlMs?: number;
  statTtlMs?: number;
  ttlMs?: number;
}
```

#### What it is useful for

Use it in front of remote or high-latency filesystems. Set shorter TTLs for frequently changing paths and a `maxBytes` cap for memory-sensitive deployments.

#### Example

```ts
import { CachingFs, InMemoryKVStore } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const source = new InMemoryFs();
await source.writeFile("/hello.txt", "hello");

const fs = new CachingFs({
  fs: source,
  cache: new InMemoryKVStore(),
  ttlMs: 30_000,
  maxBytes: 1024 * 1024,
});

console.log(await fs.readFile("/hello.txt"));
```

### Bootstrappable Mountable FS

`BootstrappableMountableFs` is the main mountable filesystem used by `X`.

#### What it does

It extends just-bash `MountableFs` and preserves sync bootstrap writes. just-bash initializes directories such as `/bin`, `/dev`, `/proc`, `/tmp`, and the default home directory through sync write methods when they are available.

#### Constructor

```ts
new BootstrappableMountableFs(options?: MountableFsOptions)
```

`MountableFsOptions` can include a base filesystem and initial mounts.

#### What it is useful for

Use it when the runtime needs mounted filesystems and still needs just-bash constructor bootstrapping to work correctly.

#### Example

```ts
import { BootstrappableMountableFs } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const base = new InMemoryFs();
const workspace = new InMemoryFs();

const fs = new BootstrappableMountableFs({ base });
fs.mount("/home/user/workspace", workspace);

await fs.writeFile("/home/user/workspace/README.md", "hello");
console.log(await workspace.readFile("/README.md"));
```

`X` creates this wrapper automatically:

```ts
const x = new X({ fs: base });
x.fs.mount("/home/user/workspace", workspace);
```
