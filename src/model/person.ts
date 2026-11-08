import { z } from 'zod';

export const PersonSexSchema = z.enum([
  'male',
  'female',
  'unknown',
  'unspecified',
]);

export type PersonSex = z.infer<typeof PersonSexSchema>;

export const PersonPrivacySchema = z.enum([
  'public',
  'private',
  'living-person restricted',
]);

export type PersonPrivacy = z.infer<typeof PersonPrivacySchema>;

export const PersonSchema = z.strictObject({
  id: z.string().min(1, 'Person id is required'),
  given_names: z.string().default(''),
  surname: z.string().default(''),
  sex: PersonSexSchema.optional(),
  gender_identity: z.string().optional(),
  birth_name: z.string().optional(),
  preferred_name: z.string().optional(),
  nickname: z.string().optional(),
  maiden_name: z.string().optional(),
  alternative_names: z.array(z.string()).default([]).optional(),
  titles: z.array(z.string()).default([]).optional(),
  occupations: z.array(z.string()).default([]).optional(),
  religion: z.string().optional(),
  nationalities: z.array(z.string()).default([]).optional(),
  biography: z.string().optional(),
  notes: z.array(z.string()).default([]).optional(),
  tags: z.array(z.string()).default([]).optional(),
  birth_event_id: z.string().optional(),
  death_event_id: z.string().optional(),
  burial_event_id: z.string().optional(),
  media_ids: z.array(z.string()).default([]).optional(),
  source_citation_ids: z.array(z.string()).default([]).optional(),
  privacy: PersonPrivacySchema.optional(),
  /** Cosa servirebbe per trovare i genitori mancanti: mostrato sul segnaposto "?" nell'albero. */
  parents_next_step: z.string().optional(),
  custom_attributes: z.record(z.any()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Person = z.infer<typeof PersonSchema>;

export function getPersonDisplayName(person: Person): string {
  const given = person.given_names || '';
  const sur = person.surname || '';
  return `${given} ${sur}`.trim();
}
