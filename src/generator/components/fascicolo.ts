import { escapeHtml } from './base.js';
import { Person, getPersonDisplayName } from '../../model/person.js';
import { NormalizedDataset } from '../../validator/index.js';
import { Serie, fascicolo, serieOf } from './serie.js';
import { getSiteSettings } from '../site.js';

export function isLiving(p: Person | undefined): boolean {
  return p?.privacy === 'living-person restricted';
}

export function nameOf(p: Person | undefined, fallback = ''): string {
  if (!p) return fallback;
  return isLiving(p) ? '[Living]' : getPersonDisplayName(p);
}

/** Anni di nascita e morte, "1893–1975", "n. 1893", "† 1975" o "". */
export function lifeYears(p: Person | undefined, dataset: NormalizedDataset): string {
  if (!p || isLiving(p)) return '';
  const b = p.birth_event_id ? dataset.events.get(p.birth_event_id)?.date?.year : undefined;
  const d = p.death_event_id ? dataset.events.get(p.death_event_id)?.date?.year : undefined;
  if (b && d) return `${b}–${d}`;
  if (b) return `n. ${b}`;
  if (d) return `† ${d}`;
  return '';
}

/** Link a una persona con il quadratino della sua serie e gli anni. */
export function personLink(id: string, dataset: NormalizedDataset, root: string, withYears = true): string {
  const p = dataset.people.get(id);
  const s = serieOf(id, dataset);
  const years = withYears ? lifeYears(p, dataset) : '';
  return `<span class="punto-serie ${s.cls}" aria-hidden="true"></span><a href="${root}people/${id}.html">${escapeHtml(nameOf(p, id))}</a>${years ? ` <span class="anni">${escapeHtml(years)}</span>` : ''}`;
}

/** Cartellino con la segnatura archivistica. */
export function cartellino(rows: Array<[string, string]>): string {
  return `<dl class="cartellino">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${v}</dd>`)
    .join('')}</dl>`;
}

export function serieLabel(s: Serie): string {
  return s.index > 0 ? `${s.roman} · ${escapeHtml(s.name)}` : 'fondo generale';
}

export function personSegnatura(p: Person, dataset: NormalizedDataset): string {
  return cartellino([
    ['Fondo', escapeHtml(getSiteSettings().title)],
    ['Serie', serieLabel(serieOf(p.id, dataset))],
    ['Fascicolo', `n. ${escapeHtml(fascicolo(p.id))}`],
  ]);
}

const EVENT_LABELS: Record<string, string> = {
  birth: 'Nascita',
  baptism: 'Battesimo',
  christening: 'Battesimo',
  marriage: 'Matrimonio',
  death: 'Morte',
  burial: 'Sepoltura',
  military_service: 'Leva',
  military: 'Leva',
  residence: 'Residenza',
  census: 'Censimento',
  emigration: 'Emigrazione',
  immigration: 'Immigrazione',
  occupation: 'Mestiere',
  divorce: 'Divorzio',
  engagement: 'Pubblicazioni',
  adoption: 'Adozione',
  civil_union: 'Unione civile',
  partnership: 'Unione',
  separation: 'Separazione',
  migration: 'Migrazione',
  other: 'Altro',
  banns: 'Pubblicazioni',
};

export function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type.replace(/_/g, ' ');
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  civil_registry: 'Stato civile',
  archival_document: 'Documento d\'archivio',
  notarial_record: 'Atto notarile',
  book: 'Libro',
  newspaper: 'Giornale',
  website: 'Sito web',
  other: 'Altro',
  parish_register: 'Registro parrocchiale',
  church_record: 'Registro parrocchiale',
  military_record: 'Ruoli militari',
  gravestone: 'Lapide',
  oral_history: 'Memoria orale',
  family_document: 'Carte di famiglia',
  letter: 'Lettera',
  census: 'Censimento',
  photograph: 'Fotografia',
  certificate: 'Certificato',
  index: 'Indice',
};

export function sourceTypeLabel(type: string | undefined): string {
  if (!type) return '';
  return SOURCE_TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

const MESI: Record<string, string> = {
  Jan: 'gen.', Feb: 'feb.', Mar: 'mar.', Apr: 'apr.', May: 'mag.', Jun: 'giu.',
  Jul: 'lug.', Aug: 'ago.', Sep: 'set.', Oct: 'ott.', Nov: 'nov.', Dec: 'dic.',
};

/** formatDate in italiano: "28 nov. 1893", "verso il 1845", "tra il 1780 e il 1785". */
export function dataIt(text: string): string {
  return text
    .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, (m) => MESI[m])
    .replace(/^abt\.\s*/, 'verso il ')
    .replace(/^est\.\s*/, 'stima ')
    .replace(/^poss\.\s*/, 'forse ')
    .replace(/^before\s+/, 'prima del ')
    .replace(/^after\s+/, 'dopo il ')
    .replace(/^between\s+(.+)\s+and\s+(.+)$/, 'tra il $1 e il $2');
}
