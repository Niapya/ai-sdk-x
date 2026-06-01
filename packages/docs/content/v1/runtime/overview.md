# Runtime

The runtime is the foundation under AI SDK X's Bash layer.

It is split into a few focused pages so each concern stays clear and composable:

- [Environment](/v1/runtime/environment)
- [Backend Storage](/v1/runtime/backend-storage)
- [File System](/v1/runtime/file-system)

Read this page first when you want the high-level model. Then jump into the child pages for the implementation details.

At a glance:

- `Environment` handles cwd and env persistence.
- `Backend Storage` provides the KV layer used by runtime wrappers.
- `File System` covers mounts, overlays, scoped views, indexes, and caching.
