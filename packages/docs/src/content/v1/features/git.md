# Git feature

The Git feature adds a `git` command to the virtual Bash runtime.

## Factory

```ts
createGitFeature(option?: boolean | GitOptions): Feature
```

Pass `false` to disable it:

```ts
x.registerFeature(createGitFeature(false));
```

Pass `GitOptions` to configure the underlying `just-git` command. AI SDK X omits options that are owned by the runtime filesystem and cwd.

```ts
const gitFeature = createGitFeature({
  userName: "Docs Bot",
  userEmail: "docs@example.com",
});

x.registerFeature(gitFeature);
```

## Construction parameters

`GitOptions` is based on `just-git` options, excluding:

- `cwd`
- `fs`
- `gitDir`
- `objectStore`
- `refStore`

The feature config resolves to:

```ts
interface GitConfig extends GitOptions {
  readonly enabled: boolean;
}
```

## Commands

The feature registers the `git` Bash command.

```ts
await x.exec("git status --short");
await x.exec("git add README.md");
await x.exec("git commit -m 'docs: update readme'");
```

The command runs against the runtime filesystem, so mounted workspace files are the files Git sees.

## Actions

`createGitFeature()` returns a plain `Feature`. It does not expose extra application actions.
