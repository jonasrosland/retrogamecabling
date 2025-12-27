import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Items
  app.get(api.items.list.path, async (req, res) => {
    const items = await storage.getItems();
    res.json(items);
  });

  app.post(api.items.create.path, async (req, res) => {
    try {
      const input = api.items.create.input.parse(req.body);
      const item = await storage.createItem(input);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Diagrams
  app.get(api.diagrams.list.path, async (req, res) => {
    const diagrams = await storage.getDiagrams();
    res.json(diagrams);
  });

  app.get(api.diagrams.get.path, async (req, res) => {
    const diagram = await storage.getDiagram(Number(req.params.id));
    if (!diagram) {
      return res.status(404).json({ message: 'Diagram not found' });
    }
    res.json(diagram);
  });

  app.post(api.diagrams.create.path, async (req, res) => {
    try {
      const input = api.diagrams.create.input.parse(req.body);
      const diagram = await storage.createDiagram(input);
      res.status(201).json(diagram);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.diagrams.update.path, async (req, res) => {
    try {
      const input = api.diagrams.update.input.parse(req.body);
      const diagram = await storage.updateDiagram(Number(req.params.id), input);
      if (!diagram) {
        return res.status(404).json({ message: 'Diagram not found' });
      }
      res.json(diagram);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.diagrams.delete.path, async (req, res) => {
    const diagram = await storage.getDiagram(Number(req.params.id));
    if (!diagram) {
      return res.status(404).json({ message: 'Diagram not found' });
    }
    await storage.deleteDiagram(Number(req.params.id));
    res.status(204).send();
  });

  return httpServer;
}

export async function seedDatabase() {
  const existingItems = await storage.getItems();
  if (existingItems.length === 0) {
    // Seed Consoles
    await storage.createItem({ 
      name: "NES", 
      category: "console", 
      specs: { outputs: ["rf", "av"], inputs: [] }
    });
    await storage.createItem({ 
      name: "SNES", 
      category: "console", 
      specs: { outputs: ["rf", "av", "s-video", "rgb"], inputs: [] }
    });
    await storage.createItem({ 
      name: "N64", 
      category: "console", 
      specs: { outputs: ["av", "s-video"], inputs: [] }
    });
    await storage.createItem({ 
      name: "PlayStation 1", 
      category: "console", 
      specs: { outputs: ["av", "s-video", "rgb"], inputs: [] }
    });

    // Seed Switchers
    await storage.createItem({ 
      name: "Otaku SCART Switch", 
      category: "switcher", 
      specs: { inputs: ["scart", "scart", "scart", "scart", "scart", "scart"], outputs: ["scart", "rca"] }
    });
    await storage.createItem({ 
      name: "Extron Crosspoint", 
      category: "switcher", 
      specs: { inputs: ["bnc", "bnc", "bnc", "bnc"], outputs: ["bnc", "bnc"] }
    });

    // Seed Displays
    await storage.createItem({ 
      name: "Sony PVM 14L5", 
      category: "display", 
      specs: { inputs: ["composite", "s-video", "rgb", "component"] }
    });
    await storage.createItem({ 
      name: "Consumer CRT", 
      category: "display", 
      specs: { inputs: ["rf", "composite"] }
    });
    await storage.createItem({ 
      name: "Modern OLED", 
      category: "display", 
      specs: { inputs: ["hdmi", "hdmi", "hdmi"] }
    });
  }
}
