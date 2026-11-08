import { z } from 'zod';
import { DateValueSchema } from './date.js';

export const MediaTypeSchema = z.enum([
  'photograph',
  'document_scan',
  'portrait',
  'map',
  'audio',
  'certificate',
  'other',
]);

export type MediaType = z.infer<typeof MediaTypeSchema>;

export const MediaSchema = z.strictObject({
  id: z.string().min(1, 'Media id is required'),
  file_path: z.string().min(1, 'file_path is required'),
  media_type: MediaTypeSchema,
  mime_type: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  date_created: DateValueSchema.optional(),
  source_id: z.string().optional(),
  person_ids: z.array(z.string()).default([]).optional(),
  event_ids: z.array(z.string()).default([]).optional(),
  privacy: z.enum(['public', 'private']).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Media = z.infer<typeof MediaSchema>;

/** True when the media file is a PDF (by mime type or extension, case-insensitive). */
export function isPdfMedia(filePath: string, mimeType?: string): boolean {
  return mimeType === 'application/pdf' || /\.pdf$/i.test(filePath);
}
