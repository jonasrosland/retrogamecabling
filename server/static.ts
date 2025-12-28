import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Handle both ESM (development) and CJS (production bundle) environments
function getPublicPath() {
  if (typeof import.meta !== "undefined" && import.meta.url) {
    // Development: server files are in server/, public is in dist/public
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    return path.resolve(__dirname, "..", "dist", "public");
  }
  // Production: server runs from project root, public is in dist/public
  return path.resolve(process.cwd(), "dist", "public");
}

export function serveStatic(app: Express) {
  const distPath = getPublicPath();
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
