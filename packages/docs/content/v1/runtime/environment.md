# Environment

The environment layer is responsible for persisting process-like state across command executions.

In AI SDK X, that state is intentionally small:

- `cwd`
- `env`

## Runtime state

The persisted snapshot is represented by `EnvSnapshot`:

```ts
interface EnvSnapshot {
  cwd: string;
  env: Record<string, string>;
}
```

`cwd` defaults to `/home/user` when a snapshot is missing or invalid.

## Backend contract

`EnvBackend` is the adapter interface used by `X`:

```ts
interface EnvBackend {
  load(): EnvSnapshot | null | Promise<EnvSnapshot | null>;
  save(snapshot: EnvSnapshot): void | Promise<void>;
}
```

This keeps environment persistence separate from the rest of the runtime.

## Built-in backends

`MemoryEnvBackend` is useful for tests and single-process usage.

`KvEnvBackend` persists the snapshot as JSON in a `KVStorage`.

```ts
import { KvEnvBackend, InMemoryKVStore, X } from "ai-sdk-x";

const x = new X({
  envBackend: new KvEnvBackend({
    kv: new InMemoryKVStore(),
    key: "project:env",
  }),
});
```

## Feature-owned env

Feature hooks can set env values with `ctx.setEnv()`.

Those values are merged into command execution, but they are not persisted as the user's long-lived environment after the command finishes.

That distinction matters:

- use the env backend for session state,
- use feature hooks for transient execution-time values.

## When to customize

Create your own env backend when you need to:

- resume sessions after a restart,
- keep project state in a remote store,
- or implement your own snapshot policy.
