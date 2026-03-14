import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// Production bundle always runs from project root
function getPublicPath() {
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
