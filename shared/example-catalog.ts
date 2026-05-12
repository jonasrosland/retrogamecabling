/** Shared between Express (`server/routes.ts`) and Cloudflare Worker (`worker/index.ts`). */
export const exampleCatalog = [
  {
    name: "simple",
    label: "Simple Setup",
    description: "Basic console to display connection",
  },
  {
    name: "medium",
    label: "Medium Setup",
    description: "Multiple consoles through a switcher",
  },
  {
    name: "advanced",
    label: "Advanced Setup",
    description: "Complex multi-switcher routing system",
  },
  {
    name: "svs",
    label: "SVS Setup",
    description: "Scalable Video Switch with multiple consoles",
  },
  {
    name: "silly-creator-setup",
    label: "Silly creator setup",
    description:
      "retrogamecabling's creator's setup, multi-path setup with analog and HDMI routing",
  },
] as const;
