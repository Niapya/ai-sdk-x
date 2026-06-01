# Skills feature

The Skills feature mounts AI agent skills, sets `SKILLS_HOME`, and adds the `x-skills` command.

Use it when you want the model to install, inspect, search, and update agent skills from git repositories or a local skills store.

## What it is

Skills are reusable, domain-specific instruction bundles for the model.

In AI SDK X, a skill is not just a prompt file. It is a mounted directory with a stable home, a lockfile-backed index, and a command surface for discovering and managing installed skills.

That design makes skills useful for tasks that need:

- reusable workflows
- project-specific conventions
- tested instructions for a narrow domain
- remote discovery and local installation

## How it is designed

The feature keeps the model-facing part and the filesystem part together:

- `SKILLS_HOME` points to the mounted skills root
- `x-skills` discovers installed skills and manages remote or local skill sources
- the feature description lists available skills and tells the model to read `SKILL.md` when a skill applies

This is why skills behave like an operable knowledge layer rather than a static prompt appendix.

## Factory

```ts
createSkillsFeature(option?: boolean | SkillsOptions): SkillsFeature
```

```ts
import { createSkillsFeature } from "ai-sdk-x";
import { InMemoryFs } from "just-bash";

const skillsFs = new InMemoryFs();

const skills = createSkillsFeature({
  fs: skillsFs,
  lockfile: true,
  mountPoint: "/home/user/skills",
});

x.registerFeature(skills);
```

## Construction parameters

```ts
interface SkillsOptions {
  fs?: IFileSystem;
  lockfile?: boolean;
  mountPoint?: string;
}
```

- `fs`: optional skills filesystem.
- `lockfile`: whether commands maintain the skills index. The default is `true`.
- `mountPoint`: path exposed inside Bash. The default is `/home/user/skills`.

The resolved config is:

```ts
interface SkillsConfig {
  readonly enabled: boolean;
  readonly fs?: IFileSystem;
  readonly lockfile: boolean;
  readonly mountPoint: string;
}
```

## Command

The feature registers `x-skills` with these subcommands:

- `install`
- `add`
- `import`
- `update`
- `list`
- `remove`
- `find`
- `search`
- `info`

```sh
x-skills list
x-skills find testing
x-skills info testing-strategy
x-skills install https://github.com/example/agent-skills@testing-strategy
```

Use `x-skills find` for installed skills. Use `x-skills search` for remote discovery.

## Actions

`createSkillsFeature()` returns `SkillsFeature`, which is `Feature & Action`.

```ts
type SkillsFeature = Feature & {
  add?: typeof addSkill;
  import?: typeof importSkill;
  install?: typeof installSkill;
  list?: typeof listSkills;
  find?: typeof findSkills;
  info?: typeof infoSkill;
  remove?: typeof removeSkill;
  search?: typeof searchSkills;
  update?: typeof updateSkills;
  createCommand?: () => Command;
};
```

Use actions when your application wants to manage skills directly.

```ts
const skills = createSkillsFeature();
x.registerFeature(skills);

const result = await skills.list?.(x.fs);
console.log(result?.stdout);
```

Install, add, import, remove, and update actions need a command context because they modify mounted files and emit command-style results.
