# Mount Custom Storage

AI SDK X uses filesystem interfaces instead of assuming a local disk. That makes the same Bash runtime work with memory, mounted project files, object storage adapters, and wrapper filesystems.

## Pass the base filesystem

By default, AI SDK X uses an in-memory filesystem as the base filesystem. Pass the top-level `fs` option when your application wants to own the runtime storage.

```ts
import { InMemoryFs, X } from "ai-sdk-x";

const baseFs = new InMemoryFs();

const x = new X({
  fs: baseFs,
});
```

AI SDK X wraps this base filesystem with `BootstrappableMountableFs`. Bash sees the mounted runtime root, and features receive that same main filesystem through `ctx.fs`.

For local development or desktop integrations, use `ReadWriteFs` when a mounted path should point at a real local directory.

```ts
import { ReadWriteFs, X, createWorkspaceFeature } from "ai-sdk-x";

const localWorkspaceFs = new ReadWriteFs({
  root: "/Users/alice/project",
});

const x = new X()
  .registerFeature(
    createWorkspaceFeature({
      fs: localWorkspaceFs,
      mountPoint: "/home/user/workspace",
    }),
  );

const result = await x.exec("ls $WORKSPACE_HOME");
console.log(result.stdout);
```

The agent sees `/home/user/workspace` inside Bash. Your application decides that the mounted filesystem is backed by `/Users/alice/project` on the host machine.

## Mount a custom feature filesystem

Feature factories that own storage usually accept `fs` and `mountPoint`.

```ts
import { InMemoryFs, X, createWorkspaceFeature } from "ai-sdk-x";

const workspaceFs = new InMemoryFs();
await workspaceFs.mkdir("/", { recursive: true });
await workspaceFs.writeFile("/README.md", "# Project\n");

const x = new X()
  .registerFeature(
    createWorkspaceFeature({
      fs: workspaceFs,
      mountPoint: "/home/user/workspace",
    }),
  );

const result = await x.exec("cat $WORKSPACE_HOME/README.md");
console.log(result.stdout);
```

The mounted filesystem is visible to Bash at the mount point, while your application can keep a handle to the original filesystem.

## Mount from your own feature

Use `onExecStart` when a custom feature needs to mount storage or set a feature-owned env variable.

```ts
import type { Feature } from "ai-sdk-x";
import { InMemoryFs } from "ai-sdk-x";

const docsFs = new InMemoryFs();

const docsFeature: Feature = {
  name: "docs",
  description: () => "Internal docs are mounted at $DOCS_HOME.",
  hooks: {
    async onExecStart(ctx) {
      ctx.fs.mount("/home/user/docs", docsFs);
      await ctx.fs.mkdir("/home/user/docs", { recursive: true });
      ctx.setEnv("DOCS_HOME", "/home/user/docs");
    },
  },
};
```

`ctx.fs` is the main runtime filesystem. Mounts added there are visible to later Bash commands and to other features.

## Built-in feature storage

Workspace, Memory, and Skills can each mount their own filesystem:

```ts
const x = new X()
  .registerFeature(createWorkspaceFeature({ fs: workspaceFs }))
  .registerFeature(createMemoryFeature({ fs: memoryFs }))
  .registerFeature(createSkillsFeature({ fs: skillsFs }));
```

## Filesystem wrappers

FS wrappers adapt the same filesystem interface for different storage behavior: mounting, scoping, indexing, caching, and transactional writes. Keep this guide focused on mounting. For the wrapper catalog and custom wrapper pattern, see [File System](/v1/runtime/file-system).
