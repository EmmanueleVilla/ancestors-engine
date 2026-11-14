import { SearchIndexRecord } from './index.js';

export interface PreparedSearchRecord extends SearchIndexRecord {
  _fullNormText: string;
  _fullCompactText: string;
  _fullPhoneticText: string;
}

/**
 * Normalizza il testo rimuovendo accenti/diacritici, apostrofi e simboli,
 * convertendo tutto in minuscolo con spazi singoli.
 */
export function normalizeSearchText(str?: string | number | null): string {
  if (str === undefined || str === null) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rimuove tutti gli spazi dal testo normalizzato per gestire cognomi con prefissi
 * (es. 'de capitani' -> 'decapitani', 'dalla torre' -> 'dallatorre').
 */
export function compactSearchText(str?: string | number | null): string {
  return normalizeSearchText(str).replace(/\s+/g, '');
}

/**
 * Variante fonetica e storica per tollerare grafie dell'800 e varianti comuni:
 * - 'ou' -> 'o' (grafia napoleonica/francesizzata come Courbetta -> Corbetta)
 * - collasso di doppie consonanti in singole per tollerare Fumagali -> Fumagalli, Corbeta -> Corbetta.
 */
export function phoneticSearchVariant(str?: string | number | null): string {
  return compactSearchText(str)
    .replace(/ou/g, 'o')
    .replace(/([a-z])\1+/g, '$1');
}

/**
 * Pre-calcola le stringhe di ricerca per un record dell'indice.
 */
export function prepareSearchRecord(record: SearchIndexRecord): PreparedSearchRecord {
  const parts: (string | number | undefined | null)[] = [
    record.display_name,
    record.given_names,
    record.surname,
    record.maiden_name,
    ...(record.alternative_names || []),
    ...(record.places || []),
    record.birth_year ? String(record.birth_year) : '',
    record.death_year ? String(record.death_year) : '',
  ];

  const fullNormText = parts.map((p) => normalizeSearchText(p)).filter(Boolean).join(' ');
  const fullCompactText = parts.map((p) => compactSearchText(p)).filter(Boolean).join('');
  const fullPhoneticText = parts.map((p) => phoneticSearchVariant(p)).filter(Boolean).join('');

  return {
    ...record,
    _fullNormText: fullNormText,
    _fullCompactText: fullCompactText,
    _fullPhoneticText: fullPhoneticText,
  };
}

/**
 * Verifica se un record soddisfa una query di ricerca con tolleranza alle varianti.
 * Ogni token della query (separato da spazio) deve essere soddisfatto (AND logico).
 */
export function matchRecord(record: PreparedSearchRecord, query: string): boolean {
  const qNorm = normalizeSearchText(query);
  if (!qNorm) return false;

  const tokens = qNorm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  for (const token of tokens) {
    const compactTok = token.replace(/\s+/g, '');
    const phoneticTok = phoneticSearchVariant(token);

    // 1. Match testuale diretto
    if (record._fullNormText.includes(token)) continue;

    // 2. Match compatto (gestisce 'decapitani' con 'de capitani' o 'de' capitani')
    if (compactTok && record._fullCompactText.includes(compactTok)) continue;

    // 3. Match fonetico/storico per token di almeno 3 caratteri (evita falsi positivi su 1-2 lettere)
    if (phoneticTok.length >= 3 && record._fullPhoneticText.includes(phoneticTok)) continue;

    return false;
  }

  return true;
}

/**
 * Filtra l'indice di ricerca con la query specificata.
 */
export function filterSearchIndex(index: PreparedSearchRecord[], query: string): PreparedSearchRecord[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return index.filter((rec) => matchRecord(rec, trimmed));
}
