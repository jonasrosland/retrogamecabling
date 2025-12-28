import { z } from 'zod';
import { itemSchema } from './schema';

export const api = {
  items: {
    list: {
      method: 'GET' as const,
      path: '/api/items',
      responses: {
        200: z.array(itemSchema),
      },
    },
  },
};
