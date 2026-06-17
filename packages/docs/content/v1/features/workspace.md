# Workspace Feature

Workspace mounts durable work files into Bash and sets `WORKSPACE_HOME`.

Use it when the agent should create, inspect, and edit deliverables inside a dedicated project directory instead of scattering files through temporary runtime paths.

## Design

Workspace is intentionally simple:

- It exposes one mounted root through `WORKSPACE_HOME`.
- Its description tells the model to keep durable deliverables there.
- It can load workspace-root agent instructions from `agents.md`, `agent.md`, or `claude.md`.
- It can use a custom filesystem or the main runtime filesystem.
- It does not add extra Bash commands.

If no custom filesystem is passed, the feature ensures `/home/user/workspace` exists in the main runtime filesystem. If you pass a custom `mountPoint` without a custom filesystem, it exposes the default workspace through a scoped subpath.

## Initialize with X.init

Workspace is enabled by default in `X.init()`.

```ts
const x = X.init();
```

Customize or disable it through the `workspace` option:

```ts
const x = X.init({
  workspace: {
    fs: workspaceFs,
    mountPoint: "/project",
    loadAgentsMd: true,
    treeMaxDepth: 5,
  },
});

const withoutWorkspace = X.init({
  workspace: false,
});
```

## Register manually

```ts
import { X, createWorkspaceFeature } from "ai-sdk-x";

const x = new X()
  .registerFeature(
    createWorkspaceFeature({
      fs: workspaceFs,
      mountPoint: "/home/user/workspace",
      loadAgentsMd: true,
      treeMaxDepth: 5,
    }),
  );
```

## Workspace agent instructions

By default, Workspace looks for an agent instructions file in the workspace root and injects its content into the environment instructions.

Lookup order is:

1. `agents.md`
2. `agent.md`
3. `claude.md`

Only the workspace root is read automatically, and lookup is case-insensitive for the known filenames. In model-facing guidance, this convention is referred to as `agents.md`. In large monorepos, nested `AGENTS.md` files should stay close to their subprojects; the agent should read them when it enters that subproject.

Disable this behavior when the application wants to manage those instructions itself:

```ts
const x = X.init({
  workspace: {
    loadAgentsMd: false,
  },
});
```

## Use in Bash

```sh
$ echo "$WORKSPACE_HOME"
$ find "$WORKSPACE_HOME" -maxdepth 2 -type f
$ cat "$WORKSPACE_HOME/README.md"
```

## Actions

`createWorkspaceFeature()` returns a plain `Feature`. It does not expose app-side actions. Use the mounted filesystem directly when your application needs to read or write workspace files outside Bash.
