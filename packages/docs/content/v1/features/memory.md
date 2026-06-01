# Memory feature

The Memory feature mounts long-term memory storage, sets `MEMORY_HOME`, and adds the `x-memory` command.

Use it when you want the model to store reusable preferences, project notes, or long-lived agent memory in a dedicated mounted filesystem.

## What it is

Memory is the persistent context layer for AI SDK X.

It is designed for information that should survive across commands and sessions:

- user preferences
- project conventions
- durable facts
- daily notes and session summaries

## How it is designed

The feature is split into a mount, an index, and a command surface:

- `MEMORY_HOME` exposes the memory filesystem to Bash
- the memory index keeps searchable metadata in sync
- `x-memory` handles add, update, delete, list, and find operations

That means memory is not just a bag of files. It is a managed persistence layer with CLI semantics, lockfile coordination, and a daily note structure.

## Factory

```ts
createMemoryFeature(option?: boolean | MemoryOptions): MemoryFeature
```

```ts
import { createMemoryFeature } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const memoryFs = new InMemoryFs();

const memory = createMemoryFeature({
  fs: memoryFs,
  mountPoint: "/home/user/memory",
});

x.registerFeature(memory);
```

## Construction parameters

```ts
interface MemoryOptions {
  fs?: IFileSystem;
  mountPoint?: string;
}
```

- `fs`: optional memory filesystem.
- `mountPoint`: path exposed inside Bash. The default is `/home/user/memory`.

The resolved config is:

```ts
interface MemoryConfig {
  readonly enabled: boolean;
  readonly fs?: IFileSystem;
  readonly mountPoint: string;
}
```

## Command

The feature registers `x-memory` with these subcommands:

- `add`
- `delete`
- `list`
- `find`
- `update`

```sh
x-memory list

printf 'Use Bun for JS tasks.' | \
  x-memory add project-style \
    --description 'Project command preference' \
    --keyword bun \
    --stdin

x-memory find bun
```

Only daily categorized entries are supported for new categorized memory entries.

The feature description also tells the model to check `AGENT.md`, `USER.md`, and `MEMORY.md` when those files matter, because the memory tree is intentionally split by responsibility.

## Actions

`createMemoryFeature()` returns `MemoryFeature`, which is `Feature & Action`.

```ts
type MemoryFeature = Feature & {
  add?: typeof addMemory;
  delete?: typeof deleteMemory;
  find?: typeof findMemory;
  list?: typeof listMemory;
  update?: typeof updateMemory;
  createCommand?: () => Command;
};
```

Use actions when your application wants to call the same memory operations without asking the model to run `x-memory`.

```ts
const memory = createMemoryFeature();
x.registerFeature(memory);

const listResult = await memory.list?.(x.fs);
console.log(listResult?.stdout);
```

Command actions that mutate files need a command context. The Bash command is usually the simpler integration path for model-driven tasks.
