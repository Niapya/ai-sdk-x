# Create Your Command

Commands are the Bash-facing API of your runtime.

Use commands when you want the agent to call a capability with normal shell syntax, discover it with `--help`, pass arguments and flags, and compose it with pipes or other Bash commands.

## Command helpers

AI SDK X provides a few helpers for building command-line interfaces:

- `defineCliCommand()` defines a leaf command that actually runs work.
- `defineCliTopic()` defines a parent command with subcommands.
- `createCommand()` turns a command or topic definition into a command you can register.
- `commandError()` returns a shell-style failed result with stderr and a non-zero exit code.
- `commandUsageError()` returns a shell-style usage error with help text.

Use `defineCliCommand()` when your command has one behavior:

```ts
const hello = defineCliCommand({
  id: "x-hello",
  type: "command",
  summary: "Print a greeting.",
  args: [
    {
      name: "name",
      required: true,
      summary: "Name to greet.",
    },
  ] as const,
  run: ({ args }) => ({
    stdout: `hello ${args.name}\n`,
    stderr: "",
    exitCode: 0,
  }),
});
```

Use `defineCliTopic()` when one command should route to subcommands:

```ts
const project = defineCliTopic({
  id: "x-project",
  type: "topic",
  summary: "Manage project metadata.",
  subcommands: [hello],
});
```

Use `createCommand()` and `registerCommand()` to make the command available in Bash:

```ts
const command = createCommand(project);
x.registerCommand(command);
```

## Example

This example creates `x-project info` and `x-project note`.

```ts
import {
  commandError,
  createCommand,
  defineCliCommand,
  defineCliTopic,
} from "ai-sdk-x";

const projectInfo = defineCliCommand({
  id: "info",
  type: "command",
  summary: "Print project information.",
  run: () => ({
    stdout: "AI SDK X project\n",
    stderr: "",
    exitCode: 0,
  }),
});

const projectNote = defineCliCommand({
  id: "note",
  type: "command",
  summary: "Write a project note.",
  usage: "x-project note <title> <body...>",
  args: [
    {
      name: "title",
      required: true,
      summary: "Note title.",
    },
    {
      name: "body",
      multiple: true,
      required: true,
      summary: "Note body.",
    },
  ] as const,
  run: async ({ args }, ctx) => {
    const body = args.body.join(" ");
    if (!body.trim()) {
      return commandError("x-project note: body is required\n", 1);
    }

    await ctx.fs.mkdir("/home/user/project", { recursive: true });
    await ctx.fs.writeFile(`/home/user/project/${args.title}.md`, `${body}\n`);

    return {
      stdout: `/home/user/project/${args.title}.md\n`,
      stderr: "",
      exitCode: 0,
    };
  },
});

const projectCommand = createCommand(
  defineCliTopic({
    id: "x-project",
    type: "topic",
    summary: "Manage project metadata.",
    subcommands: [projectInfo, projectNote],
  }),
);

x.registerCommand(projectCommand);
```

The agent can now run:

```sh
$ x-project --help
$ x-project info
$ x-project note decision "Use AI SDK X for the Bash runtime"
```

The helper functions handle help output, subcommand routing, positional args, variadic args, and shell-style command results.

