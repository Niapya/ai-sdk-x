# Patch feature

The Patch feature adds `x-patch`, a structured file editing command for Bash.

Use it when a model needs to create, update, delete, or move files with a patch format instead of raw shell redirection.

## What it is

Patch is the controlled file-editing path in AI SDK X.

Instead of letting the model compose arbitrary shell redirections, the feature funnels edits through a structured patch language. That gives you:

- explicit file operations
- predictable parsing
- safer multi-file edits
- a clear place to validate changes before they land

## How it is designed

The patch feature is intentionally narrow:

- it has one command, `x-patch`
- it is driven by a custom patch grammar
- it resolves paths relative to the command cwd
- it does not expose extra application actions

That makes it a good fit for model-driven code edits where the system should control the edit shape.

## Factory

```ts
createPatchFeature(option?: boolean): Feature
```

```ts
import { createPatchFeature } from "ai-sdk-x";

x.registerFeature(createPatchFeature());
```

Pass `false` to disable the feature.

## Command

`x-patch` applies a stripped-down, file-oriented patch format.

```sh
x-patch <<'EOF'
*** Begin Patch
*** Add File: README.md
+# Example
*** End Patch
EOF
```

Use it to add, update, delete, and move files:

```sh
x-patch <<'EOF'
*** Begin Patch
*** Update File: src/index.ts
@@
-console.log("old");
+console.log("new");
*** End Patch
EOF
```

Paths resolve relative to the command cwd.

## Actions

`createPatchFeature()` returns a plain `Feature`. It does not expose extra application actions.
