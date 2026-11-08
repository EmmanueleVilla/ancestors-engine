import { z } from 'zod';
import { DateValueSchema } from './date.js';

export const SourceTypeSchema = z.enum([
  'civil_registry',
  'parish_register',
  'church_record',
  'census',
  'archival_document',
  'notarial_record',
  'military_record',
  'gravestone',
  'photograph',
  'book',
  'newspaper',
  'website',
  'oral_history',
  'family_document',
  'other',
]);

export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SourceReliabilitySchema = z.enum([
  'high',
  'moderate',
  'low',
  'uncertain',
]);

export type SourceReliability = z.infer<typeof SourceReliabilitySchema>;

export const SourceSchema = z.strictObject({
  id: z.string().min(1, 'Source id is required'),
  title: z.string().min(1, 'Source title is required'),
  source_type: SourceTypeSchema,
  author: z.string().optional(),
  repository: z.string().optional(),
  archive_location: z.string().optional(),
  collection: z.string().optional(),
  call_number: z.string().optional(),
  url: z.string().optional(),
  publication_date: DateValueSchema.optional(),
  transcription: z.string().optional(),
  reliability: SourceReliabilitySchema.optional(),
  notes: z.array(z.string()).default([]).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Source = z.infer<typeof SourceSchema>;
