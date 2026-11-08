import { z } from 'zod';

export const RelationshipTypeSchema = z.enum([
  'biological_parent',
  'adoptive_parent',
  'legal_parent',
  'foster_parent',
  'step_parent',
  'guardian',
  'spouse',
  'partner',
  'sibling',
  'half_sibling',
  'other',
]);

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;

export const RelationshipConfidenceSchema = z.enum([
  'certain',
  'probable',
  'possible',
  'estimated',
  'unknown',
]);

export type RelationshipConfidence = z.infer<typeof RelationshipConfidenceSchema>;

export const RelationshipSchema = z.strictObject({
  id: z.string().min(1, 'Relationship id is required'),
  person_id: z.string().min(1, 'person_id is required'),
  related_person_id: z.string().min(1, 'related_person_id is required'),
  relationship_type: RelationshipTypeSchema,
  family_id: z.string().optional(),
  start_event_id: z.string().optional(),
  end_event_id: z.string().optional(),
  confidence: RelationshipConfidenceSchema.optional(),
  notes: z.array(z.string()).default([]).optional(),
  source_citation_ids: z.array(z.string()).default([]).optional(),
  privacy: z.enum(['public', 'private']).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;
