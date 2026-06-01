# AI SDK X v1

AI SDK X gives an AI model one Bash tool backed by a virtual runtime. The runtime can persist cwd and environment state, mount storage, expose feature commands, and generate a model-facing tool description.

Version 1 is organized around a few practical entry points:

- Start from the guide if you are wiring it up for the first time.
- Read feature docs when you want built-in Git, Workspace, Patch, Memory, or Skills behavior.
- Read runtime docs when you want to customize env persistence, backend storage, or filesystem mounting.

If you are extending the repo or building your own runtime, the runtime section is where the implementation details live.

Start with the guides if you are integrating AI SDK X for the first time:

- [Quick start](/v1/guide/quick-start)
- [Custom start](/v1/guide/custom-start)
- [Mount custom storage in Bash](/v1/guide/mount-custom-storage)
- [Create your feature](/v1/guide/create-your-feature)
- [Use with AI SDK](/v1/guide/use-with-ai-sdk)
- [Serverless and embedded runtimes](/v1/guide/serverless-and-embedded)

Use the feature reference when you need a specific built-in feature:

- [Git feature](/v1/features/git)
- [Workspace feature](/v1/features/workspace)
- [Patch feature](/v1/features/patch)
- [Memory feature](/v1/features/memory)
- [Skills feature](/v1/features/skills)

Use the runtime reference when you need to customize persistence, storage, environment state, or filesystem behavior:

- [Runtime overview](/v1/runtime/overview)
- [Environment](/v1/runtime/environment)
- [Backend Storage](/v1/runtime/backend-storage)
- [File System](/v1/runtime/file-system)

For a quick orientation, read [About](/v1/about) first.
