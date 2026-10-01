import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const musicReports = sqliteTable("music_reports", {
 id: text("id").primaryKey(),
 trackId: integer("track_id").notNull(),
 reason: text("reason").notNull(),
 detail: text("detail").notNull(),
 status: text("status").notNull().default("received"),
 createdAt: integer("created_at").notNull(),
});
