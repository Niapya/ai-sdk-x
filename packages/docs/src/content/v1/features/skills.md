# Skills feature

The Skills feature mounts AI agent skills, sets `SKILLS_HOME`, and adds the `x-skills` command.

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
