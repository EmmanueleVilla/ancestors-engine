import path from 'node:path';
import { loadAndValidateDataset, NormalizedDataset } from '../validator/index.js';
import { applyPublicProfile } from '../privacy/filter.js';
import { findLeaks } from '../privacy/leak-check.js';
import { loadArchiveConfig } from '../config/archive.js';
import { writeDatasetExport } from '../export/dataset.js';

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

  const counts = writeDatasetExport(dataset, outDir);

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
