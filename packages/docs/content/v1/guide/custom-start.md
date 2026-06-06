# Custom Start

Use `new X()` when you want an empty runtime and full control over what gets registered.

Unlike `X.init()`, the constructor does not add Patch, Git, Workspace, Skills, or Memory. It only creates the Bash runtime, base filesystem, environment backend, and hook list.

```ts
import { X, createPatchFeature, createWorkspaceFeature } from "ai-sdk-x";

const x = new X({
  bash: {
    cwd: "/home/user/workspace",
    network: false,
  },
})
  .registerFeature(createWorkspaceFeature())
  .registerFeature(createPatchFeature());
```

This pattern is useful when your product needs a narrower command surface, a custom storage layout, or a feature set selected per user or per task.

## Constructor

```ts
new X(options?: XOptions)
```

`XOptions` supports:

- `bash`: Bash runtime options such as `cwd`, `env`, `network`, `javascript`, and `python`.
- `fs`: the base filesystem before AI SDK X wraps it in `BootstrappableMountableFs`.
- `envBackend`: the backend that persists `cwd` and `env` across commands.
- `execHooks`: hooks registered before later `registerHook()` calls.

## Register commands

Commands are shell commands available inside Bash.

```ts
import type { Command } from "ai-sdk-x";

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

Commands registered through `registerCommand()` are trusted by default. If you need a command to be untrusted, set `trusted: false` on the command object.

## Register hooks

Hooks run around each command execution.

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

`onExecStart` receives the command, exec options, current snapshot, Bash instance, main runtime filesystem, and `setEnv()`. `onExecEnd` receives the command, options, next snapshot, and command result.

## Register features

A feature groups description, commands, and hooks.

```ts
x.registerFeature({
  name: "project",
  description: () => "Project commands are available in Bash.",
  command: [helloCommand],
  hooks: {
    onExecStart(ctx) {
      ctx.setEnv("PROJECT_HOME", "/home/user/project");
    },
  },
});
```

Built-in features are regular features created by factory functions. You can register all of them manually:

```ts
import {
  createGitFeature,
  createMemoryFeature,
  createPatchFeature,
  createSkillsFeature,
  createWorkspaceFeature,
} from "ai-sdk-x";

const x = new X()
  .registerFeature(createPatchFeature())
  .registerFeature(createGitFeature())
  .registerFeature(createWorkspaceFeature())
  .registerFeature(createSkillsFeature())
  .registerFeature(createMemoryFeature());
```
