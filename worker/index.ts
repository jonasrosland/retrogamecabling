import { api } from "../shared/routes";
import { exampleCatalog } from "../shared/example-catalog";
import items from "../shared/items.json";
import simple from "../shared/examples/simple.json";
import medium from "../shared/examples/medium.json";
import advanced from "../shared/examples/advanced.json";
import svs from "../shared/examples/svs.json";
import sillyCreatorSetup from "../shared/examples/silly-creator-setup.json";

type Env = {
  ASSETS: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
};

const examples: Record<string, unknown> = {
  simple,
  medium,
  advanced,
  svs,
  "silly-creator-setup": sillyCreatorSetup,
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === api.items.list.path) {
      return Response.json(items);
    }

    if (path === "/api/examples") {
      return Response.json(exampleCatalog);
    }

    const exampleMatch = path.match(/^\/api\/examples\/([^/]+)$/);
    if (exampleMatch) {
      const name = exampleMatch[1];
      const body = examples[name];
      if (body === undefined) {
        return Response.json({ message: "Example not found" }, { status: 404 });
      }
      return Response.json(body);
    }

    return env.ASSETS.fetch(request);
  },
};
