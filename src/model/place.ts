import { z } from 'zod';
import { DateValueSchema } from './date.js';

export const PlaceTypeSchema = z.enum([
  'city',
  'town',
  'village',
  'parish',
  'municipality',
  'province',
  'region',
  'country',
  'estate',
  'cemetery',
  'church',
  'other',
]);

export type PlaceType = z.infer<typeof PlaceTypeSchema>;

export const PlaceSchema = z.strictObject({
  id: z.string().min(1, 'Place id is required'),
  name: z.string().min(1, 'Place name is required'),
  historical_name: z.string().optional(),
  alternative_names: z.array(z.string()).default([]).optional(),
  place_type: PlaceTypeSchema.optional(),
  parent_place_id: z.string().optional(),
  country: z.string().optional(),
  administrative_area: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  valid_from: DateValueSchema.optional(),
  valid_until: DateValueSchema.optional(),
  notes: z.array(z.string()).default([]).optional(),
  source_citation_ids: z.array(z.string()).default([]).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Place = z.infer<typeof PlaceSchema>;
