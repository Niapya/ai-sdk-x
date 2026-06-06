# AI SDK X v1

AI SDK X gives an agent a virtual Bash. The Bash can run Unix-style commands, compose pipes, fetch network resources, execute WASM-backed JavaScript, TypeScript, Python, and SQLite workflows, and expose higher-level feature commands through the same shell surface.

Start with the integration path:

- [Quick Start](/v1/guide/quick-start) for the default `X.init()` runtime.
- [Custom Start](/v1/guide/custom-start) for `new X()` and manual feature registration.
- [Mount Custom Storage](/v1/guide/mount-custom-storage) for base filesystems, feature mounts, and wrappers.
- [Create Your Command](/v1/guide/create-your-command) for DX-friendly Bash commands.
- [Create Your Hooks](/v1/guide/create-your-hooks) for runtime lifecycle setup.
- [Create Your Feature](/v1/guide/create-your-feature) for commands, descriptions, hooks, and app-side actions.
- [Use With AI SDK](/v1/guide/use-with-ai-sdk) for `getTools()` and model wiring.
- [Serverless and Embedded](/v1/guide/serverless-and-embedded) for durable adapters.

Use the feature pages when you need to understand a built-in capability:

- [Workspace](/v1/features/workspace) mounts durable project files.
- [Patch](/v1/features/patch) provides structured file edits through `x-patch`.
- [Git](/v1/features/git) adds the `git` command.
- [Skills](/v1/features/skills) manages reusable agent instruction folders.
- [Memory](/v1/features/memory) manages persistent context and searchable notes.

Use the runtime pages when you are building storage adapters, customizing env persistence, or composing filesystem wrappers.
