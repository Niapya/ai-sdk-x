# Create Your Feature

A feature is a small object that extends the virtual Bash runtime.

Features are the right abstraction when one capability needs a model-facing description, Bash commands, filesystem setup, env variables, and application-side actions.

## Feature shape

```ts
import type { Feature } from "ai-sdk-x";

interface Feature {
  readonly name: string;
  readonly description?: (
    ctx: FeatureSetupContext,
  ) => string | { guidance?: string; environment?: string } | Promise<string | { guidance?: string; environment?: string }>;
  readonly command?: Command[];
  readonly hooks?: ExecHook;
}
```

Each field has one job:

- `name` is the stable feature id.
- `description` should return an object when possible.
- Put stable, permanent instructions in `guidance`.
- Put current runtime state in `environment`.
- `guidance` and `environment` are both optional. Some fixed features only need `guidance`; some stateful features only need `environment`.
- String values are kept for backwards compatibility and are treated as `environment` only.
- `command` registers Bash commands while the feature is enabled.
- `hooks` run around command execution and can initialize mounts or env.

## Description is part of the prompt

When you call `x.getInstructions()`, AI SDK X calls each enabled feature's `description()` and splits the result into system guidance and tool environment notes.
Use `guidance` for content that should stay stable over time and move into the system prompt so it can benefit from prompt caching.
Use `environment` for content that changes with the current runtime, mounted paths, or discovered files.

```ts
const projectFeature: Feature = {
  name: "project",
  description: () => ({
    guidance: "Use `project-info` for metadata.",
    environment: "Project files are mounted at $PROJECT_HOME.",
  }),
};
```

Use `guidance` for model-facing behavior and `environment` for available commands, mounted paths, and inspection hints.

## Add a command

```ts
import { createCommand, defineCliCommand } from "ai-sdk-x";

const projectInfoCommand = createCommand(
  defineCliCommand({
    id: "project-info",
    type: "command",
    summary: "Print project information.",
    run: () => ({
      stdout: "AI SDK X project\n",
      stderr: "",
      exitCode: 0,
    }),
  }),
);
```

Attach it to the feature:

```ts
const projectFeature: Feature = {
  name: "project",
  description: () => "`project-info` prints information about the current project.",
  command: [projectInfoCommand],
};

x.registerFeature(projectFeature);
```

## Add setup logic

Use hooks to initialize feature state before Bash executes commands.

```ts
const projectFeature: Feature = {
  name: "project",
  hooks: {
    async onExecStart(ctx) {
      await ctx.fs.mkdir("/home/user/project", { recursive: true });
      ctx.setEnv("PROJECT_HOME", "/home/user/project");
    },
  },
};
```

The hook receives the main runtime filesystem. Mounts and files created there are visible to Bash and other features.

## Expose actions

Some capabilities should be available without asking the model to run a Bash command. Use a `Feature & Action` union type for that.

Built-in Memory and Skills features follow this pattern: they are regular features, but they also expose methods such as `list`, `find`, `add`, or `install`.

```ts
import type { CommandContext, Feature } from "ai-sdk-x";

type ProjectFeature = Feature & {
  writeNote?: (title: string, body: string, ctx: CommandContext) => Promise<void>;
};

function createProjectFeature(): ProjectFeature {
  return {
    name: "project",
    description: () => "Project notes are stored under $PROJECT_HOME.",
    hooks: {
      async onExecStart(ctx) {
        await ctx.fs.mkdir("/home/user/project", { recursive: true });
        ctx.setEnv("PROJECT_HOME", "/home/user/project");
      },
    },
    writeNote: async (title, body, ctx) => {
      await ctx.fs.writeFile(`/home/user/project/${title}.md`, body);
    },
  };
}
```

Use actions for application-owned workflows. Use Bash commands for model-driven workflows that should be discoverable through shell help and tool descriptions.
