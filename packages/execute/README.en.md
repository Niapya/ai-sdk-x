# @ai-sdk-x/execute

Execute is a tool for executing code. This project is mainly built for Serverless environments.

> [!NOTE]
>
> If you are building an agent locally or on a server, the standard approach is to use bash.

Most Serverless environments cannot directly execute code, and even cannot use `new Function()` and `eval()`, but in some environments you can do all of this.

On Deno, you can use `import("data:text/typescript,export default " + encodeURIComponent(code))` or `import("data:text/javascript,export default " + encodeURIComponent(code))` to execute code containing ESM modules.

```ts
const code = `
import { say } from "jsr:@morinokami/deno-says/say";

say("Hello, World!");
`

await import("data:text/javascript," + encodeURIComponent(code));
```

> [!NOTE]
>
> On Deno Deploy, you can only execute JavaScript, and can only import already cached modules. You can use AST analysis and load modules from [esm.sh](https://esm.sh/) to try to bypass this limitation.

On Cloudflare Workers, you can use Dynamic Worker Loader to execute code.

You can also connect to an external Sandbox service to execute code.

Or if you are in a real Node.js environment, you can directly use the `vm` module to execute code.

## Examples

For details, see the examples for [Deno](./src/examples/deno.ts).
