import { eq } from "drizzle-orm";
import { mysqlTable, serial, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";
import { createMemory, type MemoryRecord } from "../index.js";

export const memories = mysqlTable("memories", {
	id: serial("id").primaryKey(),
	scope: varchar("scope", { length: 255 }).notNull(),
	content: text("content").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow().onUpdateNow(),
});

// Replace with your actual MySQL connection
const db = drizzle("");

const memory = createMemory({
	add: async (record) => {
		const rows = await db.insert(memories).values(record).$returningId();
		const id = rows[0].id;
		const inserted = await db.select().from(memories).where(eq(memories.id, id));
		const row = inserted[0];
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
		await db
			.update(memories)
			.set({ scope: data.scope, content: data.content })
			.where(eq(memories.id, id));
		const rows = await db.select().from(memories).where(eq(memories.id, id));
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
		const rows = await db.select().from(memories).where(eq(memories.id, id));
		const row = rows[0];
		await db.delete(memories).where(eq(memories.id, id));
		return {
			id: row.id,
			scope: row.scope,
			content: row.content,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		};
	},
});

const instance = memory("daily");
const tools = await instance.getTools();
console.log("Available tools:", Object.keys(tools));

const instance2 = memory(["daily", "work"]);
const tools2 = await instance2.getTools();
console.log("Available tools:", Object.keys(tools2));
