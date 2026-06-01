# About

AI SDK X is a Bash tool runtime for AI agents.

In long-running practice, we found that Bash is a critical interface for agents. It is the fastest way to compose Unix-style operations, inspect files, run utilities, and connect model reasoning to a real execution environment.

AI SDK X turns that into a unified virtual Bash:

- It supports the common Unix and Bash operations agents need.
- It lets you add custom features on top of the same runtime.
- It exposes a clean filesystem interface so features can mount virtual paths.
- It keeps storage and environment state persistent through runtime backends.

On top of that virtual Bash, we build higher-level capabilities like:

- `Memory` for persistent context and project knowledge
- `Skills` for reusable domain instructions and workflows
- `Workspace` for durable deliverables and project files
- `Patch` for structured, model-friendly file edits

AI SDK X also includes JS and Python runtime support through WASM, so the same design works in local, serverless, and embedded environments without depending on a traditional host runtime. Those environments can stay safe by default while still supporting real execution.

For model integration, AI SDK X works directly with the Vercel AI SDK and can generate an Agent-friendly Bash tool description automatically.

If a task needs an even more isolated execution model, AI SDK X also lets you define custom features and custom commands so the agent can run inside your own sandbox, container, or hosted runtime.

The v1 docs are organized so you can either learn the runtime model first, jump directly to a built-in feature, or follow the guide path from quick start to custom integration.

If you only want to build something quickly, start with [Quick start](/v1/guide/quick-start).
