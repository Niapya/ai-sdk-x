# Skills Feature

Skills mounts reusable agent skill folders, sets `SKILLS_HOME`, and adds the `x-skills` command.

Use it when the agent should discover, install, inspect, and apply specialized workflows or domain instructions.

## What a skill is

In AI SDK X, a skill is a directory. The directory contains a `SKILL.md` file and can contain additional resources such as scripts, templates, examples, references, or assets.

```text
my-skill/
  SKILL.md
  scripts/
    analyze.mjs
  templates/
    report.md
```

This follows the same broad pattern used by agent instruction systems such as `AGENTS.md`: keep instructions close to the resources and scripts they need, then load the relevant instructions when the task calls for them.

The Skills feature mounts those folders into Bash and maintains metadata so the model can find the right skill before acting.

## Design

Skills combines:

- A mounted skills root exposed through `SKILLS_HOME`.
- A lockfile-backed index of installed skills.
- The `x-skills` CLI for install, add, import, update, list, remove, find, search, and info.
- A model-facing description that lists available skills and tells the agent to read `SKILL.md` when a skill applies.

The feature description is generated from the current installed skills index, so `x.createToolDescription()` reflects what is available at that moment.

## Initialize with X.init

Skills is enabled by default in `X.init()`.

```ts
const x = X.init();
```

Customize or disable it through the `skills` option:

```ts
const x = X.init({
  skills: {
    fs: skillsFs,
    lockfile: true,
    mountPoint: "/home/user/skills",
  },
});

const withoutSkills = X.init({
  skills: false,
});
```

## Register manually

```ts
import { X, createSkillsFeature } from "ai-sdk-x";

const skills = createSkillsFeature({
  fs: skillsFs,
  mountPoint: "/home/user/skills",
});

const x = new X()
  .registerFeature(skills);
```

If no custom filesystem is passed, the feature initializes the default skills directory inside the main runtime filesystem.

## Use in Bash

```sh
$ x-skills list
$ x-skills find testing
$ x-skills info testing-strategy
$ x-skills install https://github.com/example/agent-skills@testing-strategy
```

Use `x-skills find` for installed skills. Use `x-skills search` for internet skill discovery.

## Run skill scripts with JS runtime

Because skills are mounted into Bash, scripts inside a skill can be executed or imported by the JS runtime when JavaScript support is enabled.

```sh
$ js-exec "$SKILLS_HOME/my-skill/scripts/analyze.mjs"
```

For reusable modules, prefer `.mjs` or `.mts` files and import paths under `$SKILLS_HOME`.

## Actions

`createSkillsFeature()` returns `SkillsFeature`, which is a feature with optional app-side methods.

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

Use actions when your application wants to manage skills directly. Use the Bash CLI when the model should discover and operate skills itself.
