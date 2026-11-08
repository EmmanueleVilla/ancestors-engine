import fs from 'node:fs';
import { z } from 'zod';
import { parseYamlFile } from '../parser/yaml.js';

/**
 * Configurazione dell'archivio (`archivio.config.yml`, alla radice dell'archivio).
 * Contiene ciò che riguarda un archivio specifico e non deve stare nel codice dell'engine:
 * chi resta visibile nel profilo pubblico, la chiave degli pseudonimi, le posizioni manuali dell'albero.
 */
const PositionSchema = z.strictObject({ x: z.number(), y: z.number() });
const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, 'colore esadecimale, es. #2f5a45');

export const ArchiveConfigSchema = z.strictObject({
  site: z
    .strictObject({
      title: z.string().optional(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      footer: z.string().optional(),
      home_title: z.string().optional(),
      home_intro: z.string().optional(),
      // Colori delle serie 1…8 (sostituiscono quelli predefiniti del CSS).
      series_colors: z.array(z.strictObject({ color: ColorSchema, on_color: ColorSchema.optional() })).max(8).default([]),
    })
    .default({}),
  // File dei prossimi passi (solo sito privato), relativo alla configurazione.
  next_steps_file: z.string().optional(),
  privacy: z
    .strictObject({
      // Persone vive che nel profilo pubblico mantengono nome e ID (per esempio l'autore).
      // I dettagli (date, eventi, note, media) restano comunque nascosti.
      named_living_ids: z.array(z.string()).default([]),
      // Chiave privata per ricavare gli pseudonimi stabili degli ID delle persone vive.
      pseudonym_key: z.string().default(''),
    })
    .default({}),
  tree: z
    .strictObject({
      // Persona radice dell'albero principale.
      root_id: z.string().optional(),
      // Coniuge della radice: i suoi antenati vengono disegnati verso il basso.
      mirror_root_id: z.string().optional(),
      // Posizioni manuali dei nodi, per ID.
      positions: z.record(z.string(), PositionSchema).default({}),
    })
    .default({}),
});

export type ArchiveConfig = z.infer<typeof ArchiveConfigSchema>;

export const DEFAULT_ARCHIVE_CONFIG: ArchiveConfig = ArchiveConfigSchema.parse({});

export interface LoadArchiveConfigResult {
  config: ArchiveConfig;
  /** Messaggio d'errore se il file esiste ma non è valido. */
  error?: string;
  /** Vero se il file non esiste e si usano i valori predefiniti. */
  missing: boolean;
}

export function loadArchiveConfig(filePath: string): LoadArchiveConfigResult {
  if (!fs.existsSync(filePath)) {
    return { config: DEFAULT_ARCHIVE_CONFIG, missing: true };
  }
  const parsed = parseYamlFile(filePath);
  if (parsed.error) {
    return { config: DEFAULT_ARCHIVE_CONFIG, missing: false, error: parsed.error.message };
  }
  const result = ArchiveConfigSchema.safeParse(parsed.data ?? {});
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { config: DEFAULT_ARCHIVE_CONFIG, missing: false, error: msg };
  }
  return { config: result.data, missing: false };
}
