import fs from 'node:fs';
import path from 'node:path';
import { NormalizedDataset } from '../validator/index.js';
import { getPersonDisplayName } from '../model/person.js';

/**
 * Controllo anti-fuga del profilo pubblico: dopo il build cerca in tutti i file generati
 * gli ID originali e i nomi delle persone vive mascherate. Il filtro privacy toglie i campi
 * delle persone vive, ma un nome può restare nel testo libero di altri record o nel codice.
 */

export interface Leak {
  file: string;
  needle: string;
  personId: string;
}

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.json', '.css', '.txt', '.xml', '.svg', '.md']);

function normalize(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
}

function usableName(part?: string): boolean {
  return !!part && part.trim().length > 1 && !part.includes('?');
}

/** Stringhe da cercare per una persona: ID originale e forme del nome. */
export function needlesFor(id: string, dataset: NormalizedDataset): string[] {
  const p = dataset.people.get(id);
  const needles = new Set<string>([id]);
  if (!p) return [...needles];
  const given = (p.given_names ?? '').trim();
  const firstGiven = given.split(/\s+/)[0];
  const surnames = [p.surname, p.maiden_name, p.birth_name].filter(usableName) as string[];
  for (const surname of surnames) {
    if (usableName(given)) {
      needles.add(`${given} ${surname}`);
      needles.add(`${surname} ${given}`);
    }
    if (usableName(firstGiven) && firstGiven !== given) {
      needles.add(`${firstGiven} ${surname}`);
      needles.add(`${surname} ${firstGiven}`);
    }
  }
  return [...needles];
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

/**
 * @param originalDataset dataset completo, prima del filtro (serve per i nomi veri)
 * @param maskedIds persone vive mascherate nel profilo pubblico
 */
export function findLeaks(outDir: string, originalDataset: NormalizedDataset, maskedIds: Set<string>): Leak[] {
  // Nomi di persone visibili (defunti o nominati): se un vivo ha un omonimo visibile, il nome non è una fuga.
  const visibleNames = new Set<string>();
  for (const [id, p] of originalDataset.people.entries()) {
    if (!maskedIds.has(id)) visibleNames.add(normalize(getPersonDisplayName(p)));
  }

  const needles: { needle: string; norm: string; personId: string }[] = [];
  for (const id of maskedIds) {
    for (const n of needlesFor(id, originalDataset)) {
      const norm = normalize(n);
      if (n !== id && visibleNames.has(norm)) continue;
      needles.push({ needle: n, norm, personId: id });
    }
  }
  if (needles.length === 0 || !fs.existsSync(outDir)) return [];

  const leaks: Leak[] = [];
  for (const file of listFiles(outDir)) {
    const rel = path.relative(outDir, file);
    const relNorm = normalize(rel);
    const isText = TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
    const content = isText ? normalize(fs.readFileSync(file, 'utf-8')) : '';
    for (const { needle, norm, personId } of needles) {
      if (relNorm.includes(norm) || (isText && content.includes(norm))) {
        leaks.push({ file: rel, needle, personId });
      }
    }
  }
  return leaks;
}
