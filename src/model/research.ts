import { z } from 'zod';

export const ResearchOutcomeSchema = z.enum([
  'found',
  'not_found',
  'partial',
  'awaiting_reply',
  'not_available',
  'withdrawn',
  'delivery_failed',
  // Research decided but not yet performed ("not yet searched" is distinct from "not found"):
  'planned',
]);

export type ResearchOutcome = z.infer<typeof ResearchOutcomeSchema>;

/** Actor performing the search (paradata: "who"). */
export const ResearchActorSchema = z.enum([
  'user',
  'assistant',
  'user_and_assistant',
  'institution',
  'other',
]);
export type ResearchActor = z.infer<typeof ResearchActorSchema>;

/** Method of the search (paradata: "how"). */
export const ResearchMethodSchema = z.enum([
  'index', // annual or decennial index
  'full_reading', // register read page by page
  'targeted_reading', // specific pages, e.g. name header strips
  'text_search', // search by name in a catalog or database
  'inquiry', // email, letter, or phone call to an institution
  'reading_room', // in-person consultation in an archive
  'other',
]);
export type ResearchMethod = z.infer<typeof ResearchMethodSchema>;

const outcomeMapping: Record<string, string> = {
  trovato: 'found',
  non_trovato: 'not_found',
  parziale: 'partial',
  in_attesa: 'awaiting_reply',
  non_disponibile: 'not_available',
  ritirata: 'withdrawn',
  non_recapitata: 'delivery_failed',
  pianificata: 'planned',
};

const actorMapping: Record<string, string> = {
  utente: 'user',
  assistente: 'assistant',
  utente_e_assistente: 'user_and_assistant',
  ente: 'institution',
};

const methodMapping: Record<string, string> = {
  indice: 'index',
  lettura_completa: 'full_reading',
  lettura_mirata: 'targeted_reading',
  ricerca_testuale: 'text_search',
  richiesta: 'inquiry',
  consultazione_in_sala: 'reading_room',
  altro: 'other',
};

/**
 * One check in the research log, including negative results.
 * Fields performed_by, method, search_terms, tools, and coverage are paradata:
 * they record who conducted the search, how, with which variants and tools,
 * and any known gaps in the source.
 */
export const ResearchEntrySchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const out = { ...val };
  if ('data' in out && !('date' in out)) { out.date = out.data; delete out.data; }
  if ('obiettivo' in out && !('goal' in out)) { out.goal = out.obiettivo; delete out.obiettivo; }
  if ('riferimenti' in out && !('references' in out)) { out.references = out.riferimenti; delete out.riferimenti; }
  if ('fonte' in out && !('source' in out)) { out.source = out.fonte; delete out.fonte; }
  if ('luogo' in out && !('place' in out)) { out.place = out.luogo; delete out.luogo; }
  if ('registro' in out && !('register' in out)) { out.register = out.registro; delete out.registro; }
  if ('anni' in out && !('years' in out)) { out.years = out.anni; delete out.anni; }
  if ('esito' in out && !('outcome' in out)) { out.outcome = out.esito; delete out.esito; }
  if ('eseguita_da' in out && !('performed_by' in out)) { out.performed_by = out.eseguita_da; delete out.eseguita_da; }
  if ('modalita' in out && !('method' in out)) { out.method = out.modalita; delete out.modalita; }
  if ('termini' in out && !('search_terms' in out)) { out.search_terms = out.termini; delete out.termini; }
  if ('strumenti' in out && !('tools' in out)) { out.tools = out.strumenti; delete out.strumenti; }
  if ('copertura' in out && !('coverage' in out)) { out.coverage = out.copertura; delete out.copertura; }
  if ('note' in out && !('notes' in out)) { out.notes = out.note; delete out.note; }

  if (typeof out.outcome === 'string' && outcomeMapping[out.outcome]) {
    out.outcome = outcomeMapping[out.outcome];
  }
  if (typeof out.performed_by === 'string' && actorMapping[out.performed_by]) {
    out.performed_by = actorMapping[out.performed_by];
  }
  if (typeof out.method === 'string' && methodMapping[out.method]) {
    out.method = methodMapping[out.method];
  }
  return out;
}, z.strictObject({
  date: z.union([z.string(), z.date()]).transform((d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d)),
  goal: z.string().min(1),
  references: z.array(z.string()).default([]),
  source: z.string().optional(),
  place: z.string().optional(),
  register: z.string().optional(),
  years: z.union([z.array(z.number()), z.string()]).optional(),
  outcome: ResearchOutcomeSchema,
  performed_by: ResearchActorSchema.optional(),
  method: ResearchMethodSchema.optional(),
  /** Names and spellings searched, including variants (e.g. "Rossi Mario", "Rosi"). */
  search_terms: z.array(z.string()).optional(),
  /** Tools used: repository scripts, AI model with version, database (e.g. "scripts/striscia_nomi.py"). */
  tools: z.array(z.string()).optional(),
  /** Known gaps or limits in consulted source (missing years, illegible pages, incomplete index). */
  coverage: z.string().optional(),
  notes: z.string().nullable().optional().transform((v) => v || undefined),
  /** Scans/crops examined in this check (MEDxxx), shown next to the entry: evidence, not a confirmed event. */
  media: z.array(z.string()).default([]).optional(),
}));

export type ResearchEntry = z.infer<typeof ResearchEntrySchema>;

export const ResearchLogSchema = z.preprocess((val: any) => {
  if (!val || typeof val !== 'object') return val;
  const out = { ...val };
  if ('ricerche' in out && !('searches' in out)) {
    out.searches = out.ricerche;
    delete out.ricerche;
  }
  return out;
}, z.strictObject({
  searches: z.array(ResearchEntrySchema).default([]),
}));

export type ResearchLog = z.infer<typeof ResearchLogSchema>;

/** Human-readable form of the `years` field: [1919, 1920, 1921, 1923] → "1919-1921, 1923". */
export function formatResearchYears(years: ResearchEntry['years']): string {
  if (years === undefined) return '';
  if (typeof years === 'string') return years;
  const sorted = [...new Set(years)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    start = cur;
    prev = cur;
  }
  return parts.join(', ');
}
