# Memory feature

The Memory feature mounts long-term memory storage, sets `MEMORY_HOME`, and adds the `x-memory` command.

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
