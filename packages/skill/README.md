# @ai-sdk-x/skill

[English](./README.en.md) | 简体中文

Skill 是一个辅助的上下文工具，等同于本地的 `Context7` 工具。

本项目主要为 Serverless 环境打造，采用 [unstorage](https://unstorage.unjs.io/) 作为缓存。

> [!NOTE]
>
> 如果您在构建您在本地或者服务器构建一个代理，标准的做法采用 bash + prompt 的方式。

大部分无服务器环境是没有持久化的文件系统，所以使用 Skill 包可以帮您在无服务器环境中创建一个能够和 Agent 等同的效果。

由于大部分的 Skill 都是一个 Git Repo，所以您可以把 Skill 存储到外部存储中，如 S3 存储。

> [!NOTE]
>
> 如果您想 Skill 存储到数据库，这也是可能的。
> 您可以使用 `isomorphic-git` 包来实现 `git clone`，然后递归地把 Skill 存储到数据库中。如果 Skill 含有一些非文本文件，你可以考虑转换为 Markdown 文件，例如借助 Cloudflare Workers 的 `env.AI.toMarkdown()`。

## 用法

详细请见 [使用 S3 作为 Skill 存储](./src/examples/s3.ts) 的例子。
