import { z } from 'zod';

export const CitationEvidenceTypeSchema = z.enum([
  'primary',
  'secondary',
  'derivative',
  'unknown',
]);

export type CitationEvidenceType = z.infer<typeof CitationEvidenceTypeSchema>;

export const CitationAssessmentSchema = z.enum([
  'supports',
  'contradicts',
  'partially_supports',
  'contextual',
]);

export type CitationAssessment = z.infer<typeof CitationAssessmentSchema>;

export const SourceCitationSchema = z.strictObject({
  id: z.string().min(1, 'SourceCitation id is required'),
  source_id: z.string().min(1, 'source_id is required'),
  claim_type: z.string().min(1, 'claim_type is required'),
  person_id: z.string().optional(),
  event_id: z.string().optional(),
  relationship_id: z.string().optional(),
  family_id: z.string().optional(),
  page_or_folio: z.string().optional(),
  quoted_text: z.string().optional(),
  evidence_type: CitationEvidenceTypeSchema.optional(),
  assessment: CitationAssessmentSchema.optional(),
  confidence: z.enum(['certain', 'probable', 'possible', 'estimated', 'unknown']).optional(),
  // Paradati della lettura: chi ha letto l'atto e se la lettura è stata controllata sull'immagine originale.
  transcribed_by: z.enum(['user', 'assistant', 'user_and_assistant', 'other']).optional(),
  verified_on_original: z.boolean().optional(),
  notes: z.array(z.string()).default([]).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type SourceCitation = z.infer<typeof SourceCitationSchema>;
