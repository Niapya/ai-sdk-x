# @ai-sdk-x/skill

Skill is an auxiliary context tool, equivalent to the local `Context7` tool.

This project is mainly built for Serverless environments and uses [unstorage](https://unstorage.unjs.io/) as cache.

> [!NOTE]
>
> If you are building an agent locally or on a server, the standard approach is to use bash + prompt.

Most serverless environments do not have a persistent file system, so using the Skill package can help you create an effect equivalent to Agent in a serverless environment.

Since most Skills are a Git Repo, you can store Skills to external storage, such as S3 storage.

> [!NOTE]
>
> If you want to store Skill in a database, that's also possible.
> You can use the `isomorphic-git` package to implement `git clone`, and then recursively store Skills to the database. If Skill contains some non-text files, you can consider converting them to Markdown files, for example with the help of Cloudflare Workers' `env.AI.toMarkdown()`.

## Usage

For details, see [Using S3 as Skill Storage](./src/examples/s3.ts) example.
