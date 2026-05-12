import type { Express } from "express";
import type { Server } from "http";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { api } from "@shared/routes";
import { exampleCatalog } from "@shared/example-catalog";

// Both dev (tsx) and prod (bundled) run with cwd at project root
function getSharedPath() {
  return resolve(process.cwd(), "shared");
}

const sharedPath = getSharedPath();
const itemsPath = join(sharedPath, "items.json");
const examplesPath = join(sharedPath, "examples");

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Items - serve from static JSON file
  app.get(api.items.list.path, async (req, res) => {
    try {
      const itemsData = readFileSync(itemsPath, "utf-8");
      const items = JSON.parse(itemsData);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Failed to load items" });
    }
  });

  // Examples - serve example diagram files
  app.get("/api/examples/:name", async (req, res) => {
    try {
      const exampleName = req.params.name;
      const examplePath = join(examplesPath, `${exampleName}.json`);
      const exampleData = readFileSync(examplePath, "utf-8");
      const example = JSON.parse(exampleData);
      res.json(example);
    } catch (err) {
      res.status(404).json({ message: "Example not found" });
    }
  });

  // List available examples
  app.get("/api/examples", async (_req, res) => {
    try {
      res.json([...exampleCatalog]);
    } catch (err) {
      res.status(500).json({ message: "Failed to list examples" });
    }
  });

  return httpServer;
}
