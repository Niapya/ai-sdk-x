# @ai-sdk-x/execute

Execute 是可执行代码的工具。

本项目主要为 Serverless 环境打造。

> [!NOTE]
>
> 如果您在构建您在本地或者服务器构建一个代理，标准的做法采用 bash 的方式。

大部分 Serverless 环境一般不能直接执行代码，甚至不能使用 `new Function()` 和 `eval()`，但是在某些环境上您可以做到这一切。

在 Deno 上，您可以使用 `import("data:text/typescript,export default " + encodeURIComponent(code))` 或 `import("data:text/javascript,export default " + encodeURIComponent(code))` 来执行包含 ESM 模块的代码。

```ts
const code = `
import { say } from "jsr:@morinokami/deno-says/say";

say("Hello, World!");
`

await import("data:text/javascript," + encodeURIComponent(code));
```

> [!NOTE]
>
> 在 Deno Deploy 上，您只能执行 javascript，并且只能导入已经缓存的模块，您可以使用 AST 分析并加载 [esm.sh](https://esm.sh/) 上的模块来尝试绕过这一限制。

在 Cloudflare Workers 上，您可以使用 Dynamic Worker Loader 来执行代码。

您还可以连接到外部 Sandbox 服务来执行代码。

或者如果您在真实 Node.js 环境中，您可以直接使用 `vm` 模块来执行代码。
