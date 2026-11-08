import fs from 'node:fs';
import path from 'node:path';
import { NormalizedDataset } from '../validator/index.js';

/** Raccolte del dataset esportato: un file JSON per ciascuna. */
export const DATASET_COLLECTIONS = ['people', 'families', 'events', 'places', 'sources', 'citations', 'media', 'research'] as const;
export type DatasetCollection = (typeof DATASET_COLLECTIONS)[number];

export function datasetCollections(dataset: NormalizedDataset): Record<DatasetCollection, unknown[]> {
  return {
    people: [...dataset.people.values()],
    families: [...dataset.families.values()],
    events: [...dataset.events.values()],
    places: [...dataset.places.values()],
    sources: [...dataset.sources.values()],
    citations: [...dataset.citations.values()],
    media: [...dataset.media.values()],
    research: dataset.research ?? [],
  };
}

/**
 * Scrive il dataset (già filtrato dal profilo) in `outDir`: un file JSON per raccolta e un README.
 * La cartella viene svuotata prima. Restituisce il numero di record per raccolta.
 */
export function writeDatasetExport(dataset: NormalizedDataset, outDir: string): Record<DatasetCollection, number> {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const collections = datasetCollections(dataset);
  for (const [name, records] of Object.entries(collections)) {
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(records, null, 2) + '\n', 'utf-8');
  }
  const counts = Object.fromEntries(Object.entries(collections).map(([k, v]) => [k, v.length])) as Record<DatasetCollection, number>;
  fs.writeFileSync(
    path.join(outDir, 'README.md'),
    `# Export pubblico\n\nGenerato da ancestors-engine (\`ancestors export\`). Persone vive mascherate come "[Living]", ID pseudonimi, niente media dei vivi.\n\n` +
      Object.entries(counts)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n') +
      '\n',
    'utf-8'
  );
  return counts;
}
