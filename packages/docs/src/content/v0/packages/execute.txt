# @ai-sdk-x/execute

Execute code in any environment. This package is primarily designed for **Serverless** environments.

> [!NOTE]
> If you are building an agent locally or on a server, the standard approach is to use bash.

## Installation

```bash
npm add @ai-sdk-x/execute
```

## Overview

Most serverless environments cannot directly execute code. They often disallow `new Function()` and `eval()`.

But these platforms usually provide some way to execute code:

| Platform | Strategy |
| --- | --- |
| **Deno / Deno Deploy** | `import("data:text/javascript,...")` |
| **Cloudflare Workers** | Dynamic Worker Loader |
| **Node.js** | `vm` module |
| **External Sandbox** | Bring your own HTTP adapter |

## Deno Example

On Deno, you can import and execute code via data URLs including ESM imports:

See the [Deno example](https://github.com/Niapya/ai-sdk-x/blob/main/packages/execute/src/examples/deno.ts) on GitHub.

> [!NOTE]
> On **Deno Deploy**, you can only execute JavaScript and only import already-cached modules. Try to use AST analysis + [esm.sh](https://esm.sh/) to pre-load modules and bypass this limitation.
