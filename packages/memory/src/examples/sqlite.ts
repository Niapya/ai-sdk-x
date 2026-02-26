import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createMemory, type MemoryRecord } from "../index.js";

export const memories = sqliteTable("memories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	scope: text("scope").notNull(),
	content: text("content").notNull(),
	createdAt: text("created_at").default(sql`(CURRENT_TIMESTAMP)`),
	updatedAt: text("updated_at").default(sql`(CURRENT_TIMESTAMP)`),
});

const db = drizzle("");

const memory = createMemory({
	add: async (record) => {
		const rows = db.insert(memories).values(record).returning().all();
		const row = rows[0];
		return {
			id: row.id,
			scope: row.scope,
			content: row.content,
			createdAt: row.createdAt ? new Date(row.createdAt) : null,
			updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
		};
	},
	query: async (scope) => {
		const rows = db.select().from(memories).where(eq(memories.scope, scope)).all();
		return rows.map(
			(row): MemoryRecord => ({
				id: row.id,
				scope: row.scope,
				content: row.content,
				createdAt: row.createdAt ? new Date(row.createdAt) : null,
				updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
			}),
		);
	},
	update: async (id, data) => {
		const rows = db
			.update(memories)
			.set({ scope: data.scope, content: data.content })
			.where(eq(memories.id, id))
			.returning()
			.all();
		const row = rows[0];
		return {
			id: row.id,
			scope: row.scope,
			content: row.content,
			createdAt: row.createdAt ? new Date(row.createdAt) : null,
			updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
		};
	},
	delete: async (id) => {
		const rows = db.delete(memories).where(eq(memories.id, id)).returning().all();
		const row = rows[0];
		return {
			id: row.id,
			scope: row.scope,
			content: row.content,
			createdAt: row.createdAt ? new Date(row.createdAt) : null,
			updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
		};
	},
});

const instance = memory("user-123");
const tools = await instance.getTools();

console.log("Available tools:", Object.keys(tools));
