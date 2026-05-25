# @ai-sdk-x/memory

Add persistent, scoped memory to your agents. This package provides primitives for storing and retrieving context information that agents can use across interactions.

## Installation

```bash
npm add @ai-sdk-x/memory
```

## Usage

`createMemory` accepts a set of CRUD adapters so you can plug in any database via [Drizzle ORM](https://orm.drizzle.team/) or a custom adapter.

## Example: SQLite

See the [SQLite example](https://github.com/niapya/ai-sdk-x/blob/main/packages/memory/src/examples/sqlite.ts) on GitHub.

## Example: MySQL

See the [MySQL example](https://github.com/niapya/ai-sdk-x/blob/main/packages/memory/src/examples/mysql.ts) on GitHub.

## Example: PostgreSQL

See the [PostgreSQL example](https://github.com/niapya/ai-sdk-x/blob/main/packages/memory/src/examples/postgresql.ts) on GitHub.

## Scopes

Scopes allow you to partition memory per user, session, or any logical grouping:

```typescript
const userMemory = memory("user-42");         // single scope
const sessionMemory = memory(["user-42", "session-9f3a"]); // multi-scope
```
