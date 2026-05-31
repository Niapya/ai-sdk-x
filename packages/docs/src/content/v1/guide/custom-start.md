# Custom start

Use `new X()` when you want to choose the runtime options and register features yourself.

```ts
import {
  X,
  createPatchFeature,
  createWorkspaceFeature,
} from "ai-sdk-x";

const x = new X({
  bash: {
    cwd: "/home/user/workspace",
    network: false,
  },
});

x.registerFeature(createPatchFeature());
x.registerFeature(
  createWorkspaceFeature({
    mountPoint: "/work",
  }),
);

const result = await x.exec("echo $WORKSPACE_HOME");
console.log(result.stdout);
```

## Constructor

```ts
new X(options?: XOptions)
```

`XOptions` supports:

- `bash`: virtual Bash options, excluding `customCommands`, `fs`, and `network` from direct just-bash wiring. `network` can be `false`.
- `envBackend`: an `EnvBackend` used to persist cwd and environment state.
- `execHooks`: hooks called before and after each command.
- `fs`: the base filesystem wrapped by `BootstrappableMountableFs`.

## Register commands

```ts
import type { Command } from "just-bash";

const helloCommand: Command = {
  name: "hello",
  execute: async () => ({
    stdout: "hello\n",
    stderr: "",
    exitCode: 0,
  }),
};

x.registerCommand(helloCommand);
```

Commands registered through `registerCommand()` are trusted by default.

## Register hooks

```ts
x.registerHook({
  onExecStart(ctx) {
    ctx.setEnv("PROJECT_MODE", "docs");
  },
  onExecEnd(ctx) {
    console.log(ctx.result.exitCode);
  },
});
```

Hooks receive the command, selected exec options, and a sanitized runtime snapshot. `onExecStart` also receives the main `fs`, the `bash` instance, and `setEnv()`.

## Register features

```ts
x.registerFeature({
  name: "project",
  description: () => "Project commands are available.",
  command: [helloCommand],
  hooks: {
    onExecStart(ctx) {
      ctx.setEnv("PROJECT_HOME", "/home/user/project");
    },
  },
});
```

A feature can contribute a model-facing description, Bash commands, and lifecycle hooks.
