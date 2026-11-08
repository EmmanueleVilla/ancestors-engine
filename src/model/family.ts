import { z } from 'zod';
import { RelationshipConfidenceSchema } from './relationship.js';

export const FamilyRelationshipTypeSchema = z.enum([
  'marriage',
  'civil_union',
  'partnership',
  'informal_union',
  'other',
]);

export type FamilyRelationshipType = z.infer<typeof FamilyRelationshipTypeSchema>;

export const FamilyPrivacySchema = z.enum(['public', 'private']);
export type FamilyPrivacy = z.infer<typeof FamilyPrivacySchema>;

export const FamilySchema = z.strictObject({
  id: z.string().min(1, 'Family id is required'),
  partner_ids: z.array(z.string()).default([]),
  relationship_type: FamilyRelationshipTypeSchema.optional(),
  start_event_id: z.string().optional(),
  end_event_id: z.string().optional(),
  children_ids: z.array(z.string()).default([]).optional(),
  // Figli noti ma volutamente non inseriti come persone (ricerca "in verticale").
  unrecorded_children: z
    .strictObject({
      count: z.number().int().positive(),
      label: z.string().optional(), // riga breve mostrata nella scheda, es. "il maggiore del 1929"
      note: z.string().optional(),
    })
    .optional(),
  // Grado di certezza del legame genitori-figlio, per i figli il cui collegamento non è provato.
  // Valore semplice = vale per tutti i genitori ({ P017_rossi_carlo: probable });
  // mappa per genitore = vale solo per quelli elencati ({ P017_rossi_carlo: { P036_rossi_mario: probable } }).
  // Assente = certo.
  child_confidence: z
    .record(z.string(), z.union([RelationshipConfidenceSchema, z.record(z.string(), RelationshipConfidenceSchema)]))
    .optional(),
  // Citazioni in più che provano il legame genitori-figlio, oltre a quelle trovate da sole
  // (citazioni del figlio con family_id della famiglia, o con claim_type "...parentage").
  child_citation_ids: z.record(z.string(), z.array(z.string())).optional(),
  notes: z.array(z.string()).default([]).optional(),
  source_citation_ids: z.array(z.string()).default([]).optional(),
  privacy: FamilyPrivacySchema.optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Family = z.infer<typeof FamilySchema>;

/** Certezza del legame tra un genitore e un figlio della famiglia (undefined = certo). */
export function getChildConfidence(family: Family, parentId: string, childId: string): string | undefined {
  const entry = family.child_confidence?.[childId];
  if (!entry) return undefined;
  const value = typeof entry === 'string' ? entry : entry[parentId];
  return value && value !== 'certain' ? value : undefined;
}
