# Workspace feature

The Workspace feature mounts durable work files into Bash and sets `WORKSPACE_HOME`.

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
