# Memory Feature

Memory mounts persistent context storage, sets `MEMORY_HOME`, and adds the `x-memory` command.

Use it when the agent should preserve user preferences, project conventions, durable facts, or session summaries across commands and sessions.

## Design

Memory is a managed context layer, not just a folder of Markdown files.

It combines:

- A mounted filesystem exposed through `MEMORY_HOME`.
- Core context files such as `AGENT.md`, `USER.md`, and `MEMORY.md`.
- Daily notes under a date-based directory.
- A metadata index for list and find operations.
- A Bash CLI, `x-memory`, that keeps files and metadata in sync.

The model-facing description tells the agent to consult memory when past facts or user preferences matter, and to use the CLI for mutations instead of writing directly into the memory tree.

## Initialize with X.init

Memory is enabled by default in `X.init()`.

```ts
const x = X.init();
```

Customize or disable it through the `memory` option:

```ts
const x = X.init({
  memory: {
    fs: memoryFs,
    mountPoint: "/home/user/memory",
  },
});

const withoutMemory = X.init({
  memory: false,
});
```

## Register manually

```ts
import { X, createMemoryFeature } from "ai-sdk-x";

const memory = createMemoryFeature({
  fs: memoryFs,
  mountPoint: "/home/user/memory",
});

const x = new X()
  .registerFeature(memory);
```

If no custom filesystem is passed, the feature initializes the default memory directory inside the main runtime filesystem.

## Use in Bash

```sh
$ x-memory list
$ x-memory find bun

$ printf 'Use Bun for JavaScript tasks.' | \
  x-memory add project-style \
    --description 'Project command preference' \
    --keyword bun \
    --stdin

$ printf 'Updated note' | x-memory update daily/2026-06-05/project-style.md --stdin
```

Only daily categorized entries are supported for new categorized memory entries.

## Actions

`createMemoryFeature()` returns `MemoryFeature`, which is a feature with optional app-side methods.

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

Use actions when your application wants to call the same memory operations directly.

```ts
const memory = createMemoryFeature();
x.registerFeature(memory);

const result = await memory.list?.(x.fs);
console.log(result?.stdout);
```

Mutating actions need a command context because they write files and return command-style results. For model-driven tasks, the Bash command is usually the cleaner interface.
