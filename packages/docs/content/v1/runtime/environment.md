# Environment

The environment layer persists process-like state across Bash executions.

AI SDK X stores only:

- `cwd`
- `env`

That state is loaded before each command and saved after each command.

## Snapshot

```ts
interface EnvSnapshot {
  cwd: string;
  env: Record<string, string>;
}
```

The snapshot represents user/session state. Feature-owned env values are merged into command execution, but they are removed before the next user env snapshot is saved.

## Backend

```ts
interface EnvBackend {
  load(): EnvSnapshot | null | Promise<EnvSnapshot | null>;
  save(snapshot: EnvSnapshot): void | Promise<void>;
}
```

`MemoryEnvBackend` is the default. It is useful for local demos, tests, and single-process runtimes.

`KvEnvBackend` stores the snapshot in a `KVStorage` backend.

```ts
import { InMemoryKVStore, KvEnvBackend, X } from "ai-sdk-x";

const x = new X({
  envBackend: new KvEnvBackend({
    kv: new InMemoryKVStore(),
    key: "session:env",
  }),
});
```

## Execution merge order

For each command, AI SDK X merges:

- Bash baseline env
- persisted session env
- feature env from hooks
- per-call `exec()` env

`replaceEnv` skips the persisted user env, but runtime and feature env can still be present so Bash remains usable.

## When to customize

Create your own `EnvBackend` when:

- serverless invocations need to resume the same cwd
- env changes should be stored in platform storage
- sessions are keyed by user, project, or conversation id
- your product needs custom snapshot retention

