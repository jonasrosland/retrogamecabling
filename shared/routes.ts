import { z } from 'zod';
import { insertItemSchema, insertDiagramSchema, items, diagrams } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  items: {
    list: {
      method: 'GET' as const,
      path: '/api/items',
      responses: {
        200: z.array(z.custom<typeof items.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/items',
      input: insertItemSchema,
      responses: {
        201: z.custom<typeof items.$inferSelect>(),
        400: errorSchemas.validation,
      },
    }
  },
  diagrams: {
    list: {
      method: 'GET' as const,
      path: '/api/diagrams',
      responses: {
        200: z.array(z.custom<typeof diagrams.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/diagrams/:id',
      responses: {
        200: z.custom<typeof diagrams.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/diagrams',
      input: insertDiagramSchema,
      responses: {
        201: z.custom<typeof diagrams.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/diagrams/:id',
      input: insertDiagramSchema.partial(),
      responses: {
        200: z.custom<typeof diagrams.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/diagrams/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
