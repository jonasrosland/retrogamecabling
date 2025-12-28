import type { Express } from "express";
import type { Server } from "http";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { api } from "@shared/routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const itemsPath = join(__dirname, "../shared/items.json");
const examplesPath = join(__dirname, "../shared/examples");

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
  app.get("/api/examples", async (req, res) => {
    try {
      res.json([
        { name: "simple", label: "Simple Setup", description: "Basic console to display connection" },
        { name: "medium", label: "Medium Setup", description: "Multiple consoles through a switcher" },
        { name: "advanced", label: "Advanced Setup", description: "Complex multi-switcher routing system" },
        { name: "svs", label: "SVS Setup", description: "Scalable Video Switch with multiple consoles" }
      ]);
    } catch (err) {
      res.status(500).json({ message: "Failed to list examples" });
    }
  });

  return httpServer;
}
