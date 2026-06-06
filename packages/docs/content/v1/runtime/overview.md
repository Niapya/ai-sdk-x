# Runtime

The AI SDK X runtime is the layer under the virtual Bash.

It connects four things:

- `X`, the application-facing runtime class.
- Bash config, which controls cwd, env, network, JavaScript, Python, and shell behavior.
- State backends, which persist cwd, env, cache, and indexes.
- Filesystems, which provide the base runtime root and feature-mounted storage.

## Runtime shape

`new X()` creates the core runtime:

```ts
const x = new X({
  bash: {
    cwd: "/home/user",
    network: true,
  },
  fs,
  envBackend,
});
```

`X.init()` uses the same constructor, then registers the built-in Patch, Git, Workspace, Skills, and Memory features.

## Bash config

Bash config controls what commands can do:

- `cwd` sets the initial working directory.
- `env` sets the initial environment.
- `network` controls network support.
- `javascript` controls the JS/TS runtime command.
- `python` controls the Python runtime command.

The generated tool description reads this config so the model only sees enabled capabilities.

## Environment backend

`EnvBackend` persists session-like process state:

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

Use the default memory backend for local use. Use `KvEnvBackend` or your own backend when a session should survive process restarts or serverless invocations.

## Base FS and mounted FS

The top-level `fs` option is the base filesystem. AI SDK X wraps it in `BootstrappableMountableFs`, which gives Bash the expected runtime layout and lets features mount additional filesystems.

Feature filesystems are mounted during hooks:

```ts
x.registerFeature({
  name: "docs",
  hooks: {
    onExecStart(ctx) {
      ctx.fs.mount("/home/user/docs", docsFs);
      ctx.setEnv("DOCS_HOME", "/home/user/docs");
    },
  },
});
```

This is the main model: one Bash runtime, one shared mountable filesystem, and feature-owned paths on top.

## Storage adapters

AI SDK X keeps adapters small:

- `KVStorage` stores strings for env snapshots, indexes, and caches.
- `IFileSystem` stores file-like data.
- FS wrappers add behavior such as indexing, caching, scoping, mounting, and transactions.

When you build your own backend, implement the smallest adapter that maps cleanly to your platform, then compose wrappers around it.

