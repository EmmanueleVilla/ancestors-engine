import fs from 'node:fs';
import path from 'node:path';
import { loadAndValidateDataset, NormalizedDataset } from '../validator/index.js';
import { applyPublicProfile } from '../privacy/filter.js';
import { findLeaks } from '../privacy/leak-check.js';
import { loadArchiveConfig } from '../config/archive.js';

export interface ExportCliOptions {
  dataDir?: string;
  outDir?: string;
  configPath?: string;
  silent?: boolean;
}

/**
 * Esporta il dataset del profilo pubblico in JSON (una lista per tipo di record), per depositarlo
 * come dataset aperto. Persone vive mascherate, ID pseudonimi, stesso controllo anti-fuga del sito.
 */
export function runExportCommand(options: ExportCliOptions): number {
  const dataDir = path.resolve(options.dataDir || './data');
  const outDir = path.resolve(options.outDir || './export-public');
  const configPath = path.resolve(options.configPath || './archivio.config.yml');
  const silent = options.silent ?? false;

  const validation = loadAndValidateDataset(dataDir);
  if (!validation.valid || !validation.dataset) {
    if (!silent) console.error(`[ERROR] Export halted: dataset non valido (${validation.errors.length} errori). Esegui 'validate'.`);
    return 1;
  }
  const configResult = loadArchiveConfig(configPath);
  if (configResult.error) {
    if (!silent) console.error(`[ERROR] Export halted: configurazione non valida (${configPath}): ${configResult.error}`);
    return 1;
  }
  const { config } = configResult;
  const { dataset, maskedIds } = applyPublicProfile(validation.dataset, {
    namedLivingIds: config.privacy.named_living_ids,
    pseudonymKey: config.privacy.pseudonym_key,
  });

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const collections: Record<string, unknown[]> = {
    people: [...dataset.people.values()],
    families: [...dataset.families.values()],
    events: [...dataset.events.values()],
    places: [...dataset.places.values()],
    sources: [...dataset.sources.values()],
    citations: [...dataset.citations.values()],
    media: [...dataset.media.values()],
    research: dataset.research ?? [],
  };
  for (const [name, records] of Object.entries(collections)) {
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(records, null, 2) + '\n', 'utf-8');
  }
  const counts = Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length]));
  fs.writeFileSync(
    path.join(outDir, 'README.md'),
    `# Export pubblico\n\nGenerato da ancestors-engine (\`ancestors export\`). Persone vive mascherate come "[Living]", ID pseudonimi, niente media dei vivi.\n\n` +
      Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`).join('\n') +
      '\n',
    'utf-8'
  );

  const leaks = findLeaks(outDir, validation.dataset as NormalizedDataset, maskedIds);
  if (leaks.length > 0) {
    if (!silent) {
      console.error(`[ERROR] Export pubblico: ${leaks.length} fuga/fughe di dati di persone vive:`);
      for (const l of leaks.slice(0, 50)) console.error(`  - "${l.needle}" (${l.personId}) in ${l.file}`);
      console.error(`L'export in ${outDir} NON va pubblicato.`);
    }
    return 3;
  }
  if (!silent) console.log(`[SUCCESS] Export pubblico in ${outDir} (${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')})`);
  return 0;
}
