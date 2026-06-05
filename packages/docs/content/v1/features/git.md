# Git Feature

Git adds a `git` command to the virtual Bash runtime.

Use it when the agent should inspect repository state, stage changes, view diffs, and create commits against the same filesystem Bash sees.

## Design

The feature wraps `just-git` as a Bash command. AI SDK X owns runtime filesystem and cwd wiring, so `GitOptions` omits options such as `fs`, `cwd`, `gitDir`, `objectStore`, and `refStore`.

## Initialize with X.init

Git is enabled by default in `X.init()`.

```ts
const x = X.init();
```

Customize or disable it through the `git` option:

```ts
const x = X.init({
  git: {
    userName: "Docs Bot",
    userEmail: "docs@example.com",
  },
});

const withoutGit = X.init({
  git: false,
});
```

## Register manually

```ts
import { X, createGitFeature } from "ai-sdk-x";

const x = new X()
  .registerFeature(
    createGitFeature({
      userName: "Docs Bot",
      userEmail: "docs@example.com",
    }),
  );
```

## Use in Bash

```sh
$ git status --short
$ git diff
$ git add README.md
$ git commit -m "docs: update readme"
```

The command runs inside the runtime filesystem. Mounted workspace files are the files Git sees.

## Actions

`createGitFeature()` returns a plain `Feature`. It does not expose app-side actions.
