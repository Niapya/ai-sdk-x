# Quick start

Use `X.init()` when you want the standard runtime with the built-in features already registered.

`X.init()` creates an `X` instance and registers these features.:

- Patch
- Git
- Workspace
- Skills
- Memory

## Install

```ts
import { X } from "ai-sdk-x";
```

## Create the runtime

```ts
import { X } from "ai-sdk-x";

const x = X.init({
  bash: {
    cwd: "/home/user/workspace",
    network: false,
  },
});

const result = await x.exec("pwd && ls -la");
console.log(result.stdout);
```

`X.init()` accepts the base `XOptions` plus built-in feature options:

```ts
const x = X.init({
  bash: {
    cwd: "/home/user/workspace",
    env: {
      NODE_ENV: "test",
    },
  },
  workspace: {
    mountPoint: "/workspace",
  },
  memory: false,
  skills: true,
  git: true,
  patch: true,
});
```

Pass `false` to disable a built-in feature. Pass an options object to customize that feature.

## Get the Bash tool

```ts
const tools = await x.getTools();

// Pass tools.bash to your model provider.
```

The generated Bash tool description includes:

- The initial cwd
- Usage rules for the Bash tool
- Large file inspection guidance
- Network, JavaScript, and Python capability notes when enabled
- A feature block for each registered feature

## Run commands directly

```ts
await x.exec("mkdir -p notes");
await x.exec("printf 'hello' > notes/hello.txt");

const result = await x.exec("cat notes/hello.txt");
console.log(result.stdout);
```

`X.exec()` persists cwd and environment variables through the configured env backend. Per-command `env` and `replaceEnv` options do not overwrite feature-owned env values.
