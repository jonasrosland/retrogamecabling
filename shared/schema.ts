import { pgTable, text, serial, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===
export const items = pgTable("items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // 'console', 'switcher', 'display', 'cable'
  specs: jsonb("specs").$type<{
    inputs?: string[];
    outputs?: string[];
    signals?: string[];
  }>().notNull(),
  imageUrl: text("image_url"),
});

export const diagrams = pgTable("diagrams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  data: jsonb("data").notNull(), // ReactFlow state
});

// === BASE SCHEMAS ===
export const insertItemSchema = createInsertSchema(items).omit({ id: true });
export const insertDiagramSchema = createInsertSchema(diagrams).omit({ id: true });

// === EXPLICIT API CONTRACT TYPES ===
export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;

export type Diagram = typeof diagrams.$inferSelect;
export type InsertDiagram = z.infer<typeof insertDiagramSchema>;
export type UpdateDiagramRequest = Partial<InsertDiagram>;
