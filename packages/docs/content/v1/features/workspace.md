# Workspace feature

The Workspace feature mounts durable work files into Bash and sets `WORKSPACE_HOME`.

Use it when you want the model to work inside a dedicated project directory that survives across commands and can be mounted from a custom filesystem.

## What it is

Workspace is the durable working area for user-facing files.

It is where the model should create and edit deliverables, source files, notes, and any other output that belongs to the project rather than to temporary scratch space.

## How it is designed

The feature is built around one root path:

- `WORKSPACE_HOME` tells Bash where the workspace lives
- the mounted filesystem makes that root durable or platform-backed
- the feature description tells the model to keep all deliverables under that path

If no custom filesystem is passed, the feature uses the main runtime filesystem and ensures the default workspace directory exists.

If a custom mount point is used without a custom filesystem, it maps the workspace through a subpath filesystem so the model still sees a clean workspace root.

## Factory

```ts
createWorkspaceFeature(option?: boolean | WorkspaceOptions): Feature
```

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

## Construction parameters

```ts
interface WorkspaceOptions {
  fs?: IFileSystem;
  mountPoint?: string;
}
```

- `fs`: optional filesystem mounted as the workspace.
- `mountPoint`: path exposed inside Bash. The default is `/home/user/workspace`.

The resolved config is:

```ts
interface WorkspaceConfig {
  readonly enabled: boolean;
  readonly fs?: IFileSystem;
  readonly mountPoint: string;
}
```

## Commands and env

The Workspace feature does not add a command. It mounts storage and sets env:

```sh
echo "$WORKSPACE_HOME"
find "$WORKSPACE_HOME" -maxdepth 2 -type f
```

If no filesystem is provided, the feature creates the default workspace directory in the main runtime FS. If a custom mount point is used without a custom filesystem, it maps that path to the default workspace path through a subpath FS.

## Actions

`createWorkspaceFeature()` returns a plain `Feature`. It does not expose extra application actions.
