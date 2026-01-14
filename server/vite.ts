import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  // Get HMR configuration from environment for reverse proxy setup
  // When behind a reverse proxy, set these to your public domain
  // e.g., VITE_HMR_HOST=retrogamecabling.com VITE_HMR_PORT=443 VITE_HMR_PROTOCOL=wss
  const hmrHost = process.env.VITE_HMR_HOST || process.env.HMR_HOST;
  const hmrPort = process.env.VITE_HMR_PORT || process.env.HMR_PORT;
  const hmrProtocol = process.env.VITE_HMR_PROTOCOL || process.env.HMR_PROTOCOL;
  
  const hmrConfig: any = {
    server,
    path: "/vite-hmr",
  };
  
  // Only set client connection options if behind a reverse proxy
  if (hmrHost) {
    hmrConfig.host = hmrHost;
  }
  if (hmrPort) {
    hmrConfig.port = parseInt(hmrPort, 10);
    hmrConfig.clientPort = parseInt(hmrPort, 10);
  }
  if (hmrProtocol) {
    hmrConfig.protocol = hmrProtocol;
  }
  
  const serverOptions = {
    middlewareMode: true,
    hmr: hmrConfig,
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
