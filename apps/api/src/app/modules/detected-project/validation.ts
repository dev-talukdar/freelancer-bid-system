import { z } from 'zod';
import { Types } from 'mongoose';

export const objectIdParamSchema = z.object({
  id: z.string().refine((value) => Types.ObjectId.isValid(value), 'Invalid MongoDB ObjectId'),
});

export const detectedProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const unnotifiedProjectsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
