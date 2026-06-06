# Examples

These examples show AI SDK X in local and serverless agent applications.

## Local Next.js

[Niapya/x-next](https://github.com/Niapya/x-next) is a Next.js App Router agent demo powered by AI SDK X and AI SDK v6.

The app uses React 19, Next.js 16, AI SDK, AI Elements-style chat components, Shadcn/Radix UI primitives, Streamdown rendering, and OpenRouter by default. It keeps one shared `X.init()` instance so Bash state, cwd, env, and the virtual filesystem persist across tool calls. The UI renders Bash tool calls as terminal output and exposes a virtual file browser with lazy-loaded directories and file previews.

Use this example when you want a local full-stack agent app with a visible Bash runtime and workspace UI.

## Serverless Cloudflare Worker

[Niapya/x-worker](https://github.com/Niapya/x-worker) is a Cloudflare Workers + Vite example that runs an agent with AI SDK X tools.

The frontend uses Vite, React, Agents React bindings, Shadcn UI, PromptKit UI, Streamdown, and Tailwind. The backend uses Cloudflare's Agents framework with an `AIChatAgent`, Workers AI, KV, R2, Durable Objects with SQLite migrations, and AI SDK X as the Bash tool runtime. The Worker config enables `nodejs_compat`, binds `AI`, `AGENT_KV`, `AGENT_OBJECTS`, and a `ChatAgent` Durable Object.

Use this example when you want to run the same virtual Bash idea inside a Cloudflare serverless agent architecture.

## Others

If you create an awesome project, open an issue and we will add it here.
