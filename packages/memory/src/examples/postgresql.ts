import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createMemory, type MemoryRecord } from "../index.js";

export const memories = pgTable("memories", {
	id: serial("id").primaryKey(),
	scope: text("scope").notNull(),
	content: text("content").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

// Replace with your actual PostgreSQL connection
const db = drizzle("");

const memory = createMemory({
	add: async (record) => {
		const rows = await db.insert(memories).values(record).returning();
		const row = rows[0];
		return {
			id: row.id,
			scope: row.scope,
			content: row.content,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	},
	query: async (scope) => {
		const rows = await db.select().from(memories).where(eq(memories.scope, scope));
		return rows.map(
			(row): MemoryRecord => ({
				id: row.id,
				scope: row.scope,
				content: row.content,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			}),
		);
	},
	update: async (id, data) => {
		const rows = await db
			.update(memories)
			.set({ scope: data.scope, content: data.content })
			.where(eq(memories.id, id))
			.returning();
		const row = rows[0];
		return {
			id: row.id,
			scope: row.scope,
			content: row.content,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	},
	delete: async (id) => {
		const rows = await db.delete(memories).where(eq(memories.id, id)).returning();
		const row = rows[0];
		return {
			id: row.id,
			scope: row.scope,
			content: row.content,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	},
});

const instance = memory("user-123");
const tools = await instance.getTools();

console.log("Available tools:", Object.keys(tools));
