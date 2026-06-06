# Patch Feature

Patch adds `x-patch`, a structured file editing command.

Use it when the model should create, update, delete, or move files through a predictable patch format instead of ad hoc shell redirection.

## Design

Patch is a narrow feature:

- One command: `x-patch`.
- One patch envelope: `*** Begin Patch` to `*** End Patch`.
- File operations for add, update, delete, and move.
- Paths resolved relative to the command cwd.

The feature description strongly tells the model to use `x-patch` for file modifications when the change can be expressed as a patch.

## Initialize with X.init

Patch is enabled by default in `X.init()`.

```ts
const x = X.init();
```

Disable it when the agent should not have the structured edit command:

```ts
const x = X.init({
  patch: false,
});
```

## Register manually

```ts
import { X, createPatchFeature } from "ai-sdk-x";

const x = new X()
  .registerFeature(createPatchFeature());
```

## Use in Bash

```sh
$ x-patch <<'EOF'
*** Begin Patch
*** Add File: README.md
+# Example
*** End Patch
EOF
```

Update a file:

```sh
$ x-patch <<'EOF'
*** Begin Patch
*** Update File: src/index.ts
@@
-console.log("old");
+console.log("new");
*** End Patch
EOF
```

Move while updating:

```sh
$ x-patch <<'EOF'
*** Begin Patch
*** Update File: old.md
*** Move to: new.md
@@
-old
+new
*** End Patch
EOF
```

## Actions

`createPatchFeature()` returns a plain `Feature`. It does not expose app-side actions.
