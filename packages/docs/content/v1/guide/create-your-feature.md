# Create your feature

A feature is a small object that extends the Bash runtime.

```ts
import type { Feature } from "ai-sdk-x";
```

## Feature shape

```ts
interface Feature {
  readonly name: string;
  readonly description?: (ctx: FeatureSetupContext) => string | Promise<string>;
  readonly command?: Command[];
  readonly hooks?: ExecHook;
}
```

Use each field for one purpose:

- `name`: stable feature identifier used in registration, diagnostics, and model-facing description blocks.
- `description`: text appended to the generated Bash tool description.
- `command`: Bash commands made available when the feature is registered.
- `hooks`: lifecycle hooks for setup, env injection, mounts, and observation.

## Create a command

```ts
import { createCommand, defineCliCommand } from "ai-sdk-x";

const commandDefinition = defineCliCommand({
  id: "project-info",
  type: "command",
  summary: "Print project information.",
  usage: "project-info",
  run: () => ({
    stdout: "AI SDK X project\n",
    stderr: "",
    exitCode: 0,
  }),
});

const projectInfoCommand = createCommand(commandDefinition);
```

`defineCliCommand()` gives the command a consistent help surface. `createCommand()` converts that definition into a just-bash command.

## Add setup logic

```ts
const projectFeature: Feature = {
  name: "project",
  description: () =>
    "The `project-info` command prints information about the current project.",
  command: [projectInfoCommand],
  hooks: {
    async onExecStart(ctx) {
      await ctx.fs.mkdir("/home/user/project", { recursive: true });
      ctx.setEnv("PROJECT_HOME", "/home/user/project");
    },
  },
};

x.registerFeature(projectFeature);
```

`onExecStart()` runs before each command. Use it to ensure mounted paths and env variables exist before Bash evaluates the command.

## Expose actions

Built-in Memory and Skills features return `Feature & Action`: they are regular features, but they also expose methods that your application can call without going through Bash.

You can use the same pattern:

```ts
import type { CommandContext } from "just-bash";
import type { Feature } from "ai-sdk-x";

type ProjectFeature = Feature & {
  writeNote?: (title: string, body: string, ctx: CommandContext) => Promise<void>;
};

function createProjectFeature(): ProjectFeature {
  return {
    name: "project",
    hooks: {
      async onExecStart(ctx) {
        await ctx.fs.mkdir("/home/user/project", { recursive: true });
      },
    },
    writeNote: async (title, body, ctx) => {
      await ctx.fs.writeFile(`/home/user/project/${title}.md`, body);
    },
  };
}
```

Use actions for application-level operations that share the same implementation as the Bash command.
