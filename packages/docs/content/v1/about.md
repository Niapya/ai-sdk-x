# About

AI SDK X is a virtual Bash designed for agents.

In long-running practice, we found that agents are strong at this style of work: inspecting text, composing commands, and using Bash as a bridge to a real execution environment. AI SDK X turns that interface into one runtime that can be used locally, in a serverless worker, or inside an embedded application.

Inside this Bash, an agent can use:

- Most Unix commands needed for file inspection, text processing, archives, process-like workflows, and project navigation.
- Shell pipes, redirects, heredocs, and command composition.
- Network commands such as `curl`, plus helpers like `html-to-markdown` for turning web pages into inspectable Markdown.
- WASM-backed JavaScript or TypeScript, Python, and SQLite runtimes.

The core idea is simple: give the model one Bash tool, then mount the capabilities it needs into that Bash. Features can add commands, filesystems, environment variables, model-facing descriptions, and lifecycle hooks. Your application keeps control of what is enabled and where state is stored.

The default `X.init()` runtime is the convenient path. It gives you Bash, networking, JS, Python, SQLite, and the built-in Patch, Git, Workspace, Skills, and Memory features.

When you need a narrower runtime, use `new X()` and register only the features, commands, hooks, and storage adapters your application wants.
