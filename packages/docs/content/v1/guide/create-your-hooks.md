# Create Your Hooks

Hooks let your application run code around every Bash execution.

AI SDK X supports two hook points:

- `onExecStart`, called before Bash runs the command.
- `onExecEnd`, called after Bash returns a result and the next runtime snapshot is known.

## Register a hook

```ts
const x = new X();

x.registerHook({
  onExecStart(ctx) {
    ctx.setEnv("PROJECT_MODE", "docs");
  },
  onExecEnd(ctx) {
    console.log(ctx.command, ctx.result.exitCode);
  },
});
```

`onExecStart` receives:

- `command`
- selected exec `options`
- the current `snapshot`
- the live `bash` instance
- the main runtime `fs`
- `setEnv(key, value)`

`onExecEnd` receives:

- `command`
- selected exec `options`
- the next `snapshot`
- the `result`

## Runtime lifecycle

Each `x.exec()` or AI SDK tool call follows this lifecycle:

1. Load the persisted env snapshot from `envBackend`.
2. Run registered `onExecStart` hooks.
3. Merge Bash env, persisted env, feature env, and per-call env.
4. Execute the Bash command.
5. Save the next cwd and env snapshot.
6. Run registered `onExecEnd` hooks.

Feature-owned env values set with `ctx.setEnv()` are available during command execution but are not persisted as user env after the command finishes.

## Initialize once with AsyncOnce

Use `AsyncOnce` when a hook may run many times but setup should happen once.

```ts
import { AsyncOnce, X } from "ai-sdk-x";
import type { ExecHookStartContext } from "ai-sdk-x";

const initialize = new AsyncOnce<[ExecHookStartContext]>(async (ctx) => {
  await ctx.fs.mkdir("/home/user/project", { recursive: true });
  ctx.setEnv("PROJECT_HOME", "/home/user/project");
});

const x = new X();

x.registerHook({
  onExecStart(ctx) {
    return initialize.run(ctx);
  },
});
```

`AsyncOnce` also supports retrying failed setup:

```ts
const initialize = new AsyncOnce(setup, {
  retryOnFailure: true,
});
```

Built-in Memory and Skills features use this pattern to mount storage and initialize indexes without repeating setup on every command.

