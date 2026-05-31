# Patch feature

The Patch feature adds `x-patch`, a structured file editing command for Bash.

## Factory

```ts
createPatchFeature(option?: boolean | PatchOptions): Feature
```

```ts
import { createPatchFeature } from "ai-sdk-x";

x.registerFeature(createPatchFeature());
```

## Construction parameters

The current `PatchOptions` type is empty:

```ts
type PatchOptions = Record<string, never>;
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
