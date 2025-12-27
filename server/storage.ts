import { db } from "./db";
import {
  items,
  diagrams,
  type InsertItem,
  type InsertDiagram,
  type UpdateDiagramRequest,
  type Item,
  type Diagram
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getItems(): Promise<Item[]>;
  createItem(item: InsertItem): Promise<Item>;
  
  getDiagrams(): Promise<Diagram[]>;
  getDiagram(id: number): Promise<Diagram | undefined>;
  createDiagram(diagram: InsertDiagram): Promise<Diagram>;
  updateDiagram(id: number, updates: UpdateDiagramRequest): Promise<Diagram>;
  deleteDiagram(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getItems(): Promise<Item[]> {
    return await db.select().from(items);
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(insertItem).returning();
    return item;
  }

  async getDiagrams(): Promise<Diagram[]> {
    return await db.select().from(diagrams);
  }

  async getDiagram(id: number): Promise<Diagram | undefined> {
    const [diagram] = await db.select().from(diagrams).where(eq(diagrams.id, id));
    return diagram;
  }

  async createDiagram(insertDiagram: InsertDiagram): Promise<Diagram> {
    const [diagram] = await db.insert(diagrams).values(insertDiagram).returning();
    return diagram;
  }

  async updateDiagram(id: number, updates: UpdateDiagramRequest): Promise<Diagram> {
    const [updated] = await db.update(diagrams)
      .set(updates)
      .where(eq(diagrams.id, id))
      .returning();
    return updated;
  }

  async deleteDiagram(id: number): Promise<void> {
    await db.delete(diagrams).where(eq(diagrams.id, id));
  }
}

export const storage = new DatabaseStorage();
