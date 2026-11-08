import { z } from 'zod';
import { DateValueSchema } from './date.js';

export const EventTypeSchema = z.enum([
  'birth',
  'baptism',
  'christening',
  'adoption',
  'marriage',
  'civil_union',
  'partnership',
  'divorce',
  'separation',
  'death',
  'burial',
  'residence',
  'migration',
  'immigration',
  'emigration',
  'occupation',
  'education',
  'military_service',
  'religious_event',
  'property_transaction',
  'census',
  'probate',
  'other',
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export const EventSchema = z.strictObject({
  id: z.string().min(1, 'Event id is required'),
  event_type: EventTypeSchema,
  person_ids: z.array(z.string()).default([]).optional(),
  family_id: z.string().optional(),
  date: DateValueSchema.optional(),
  place_id: z.string().optional(),
  description: z.string().optional(),
  notes: z.array(z.string()).default([]).optional(),
  source_citation_ids: z.array(z.string()).default([]).optional(),
  media_ids: z.array(z.string()).default([]).optional(),
  confidence: z.enum(['certain', 'probable', 'possible', 'estimated', 'unknown']).optional(),
  privacy: z.enum(['public', 'private']).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Event = z.infer<typeof EventSchema>;
