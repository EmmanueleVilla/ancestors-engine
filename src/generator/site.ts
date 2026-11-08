import { NormalizedDataset } from '../validator/index.js';

/**
 * Impostazioni del sito che dipendono dall'archivio (titoli, testi, persona radice, colori).
 * Vengono da `archivio.config.yml` (sezione `site` e `tree.root_id`) e sono impostate una volta
 * per build da `generateStaticSite`. Il codice dell'engine non contiene nomi di famiglie o persone.
 */
export interface SiteSettings {
  title: string;
  subtitle: string;
  description: string;
  footer: string;
  homeTitle: string;
  /** Paragrafo introduttivo della home (testo semplice). */
  homeIntro: string;
  /** Persona radice dell'albero principale (ID già pseudonimizzato nel profilo pubblico). */
  rootPersonId?: string;
  /** Colori delle serie 1…8 (sostituiscono quelli predefiniti del CSS). */
  seriesColors: { color: string; onColor?: string }[];
}

export const DEFAULT_SITE: SiteSettings = {
  title: 'Archivio di famiglia',
  subtitle: 'Fondo di famiglia',
  description: 'Archivio genealogico di famiglia',
  footer: 'Archivio di famiglia · ogni dato rimanda alla sua fonte',
  homeTitle: 'Archivio di famiglia',
  homeIntro: 'Ogni persona è un fascicolo, ogni dato rimanda all\'atto che lo prova.',
  seriesColors: [],
};

let current: SiteSettings = DEFAULT_SITE;

export function setSiteSettings(settings: Partial<SiteSettings> | undefined): void {
  current = { ...DEFAULT_SITE, ...(settings ?? {}) };
}

export function getSiteSettings(): SiteSettings {
  return current;
}

/** Persona radice configurata, se esiste nel dataset. */
export function getRootPersonId(dataset: NormalizedDataset): string | undefined {
  const id = current.rootPersonId;
  return id && dataset.people.has(id) ? id : undefined;
}

/** Variabili CSS per i colori delle serie configurati (vuoto se non configurati). */
export function seriesColorsStyle(): string {
  const rules = current.seriesColors
    .slice(0, 8)
    .map((c, i) => `--serie-${i + 1}: ${c.color};${c.onColor ? ` --su-serie-${i + 1}: ${c.onColor};` : ''}`)
    .join(' ');
  return rules ? `<style>:root { ${rules} }</style>` : '';
}
