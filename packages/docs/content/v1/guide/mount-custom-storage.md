# Mount custom storage in Bash

Use a feature hook to mount custom storage into the main runtime filesystem. The same filesystem is used by feature setup and by commands executed inside Bash.

## Mount a custom filesystem

```ts
import { X, createWorkspaceFeature } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const projectFs = new InMemoryFs();
await projectFs.mkdir("/", { recursive: true });
await projectFs.writeFile("/README.md", "# Project\n");

const x = new X();

x.registerFeature(
  createWorkspaceFeature({
    fs: projectFs,
    mountPoint: "/home/user/workspace",
  }),
);

const result = await x.exec("cat $WORKSPACE_HOME/README.md");
console.log(result.stdout);
```

`createWorkspaceFeature()` mounts the provided filesystem at `mountPoint` and sets `WORKSPACE_HOME`.

## Mount storage from a custom feature

```ts
import type { Feature } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const docsFs = new InMemoryFs();
await docsFs.mkdir("/", { recursive: true });
await docsFs.writeFile("/index.md", "# Internal docs\n");

const docsFeature: Feature = {
  name: "docs",
  description: () => "Internal docs are mounted at $DOCS_HOME.",
  hooks: {
    onExecStart(ctx) {
      ctx.fs.mount("/home/user/docs", docsFs);
      ctx.setEnv("DOCS_HOME", "/home/user/docs");
    },
  },
};

x.registerFeature(docsFeature);
```

The hook receives `ctx.fs`, which is the main `BootstrappableMountableFs`. Mounts added there are visible to all Bash commands.

## Connect to runtime FS wrappers

```ts
import {
  CachingFs,
  IndexedFs,
  TransactionalFs,
  InMemoryKVStore,
} from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const source = new InMemoryFs();
const cache = new InMemoryKVStore();

const indexed = new IndexedFs({ fs: source, cache });
const cached = new CachingFs({ fs: indexed, cache, ttlMs: 60_000 });
const transactional = new TransactionalFs({ fs: cached, cache });

x.registerFeature({
  name: "storage",
  hooks: {
    onExecStart(ctx) {
      ctx.fs.mount("/home/user/storage", transactional);
      ctx.setEnv("STORAGE_HOME", "/home/user/storage");
    },
  },
});
```

This pattern lets Bash work with one mounted path while your application chooses indexing, caching, and transaction semantics behind it.
