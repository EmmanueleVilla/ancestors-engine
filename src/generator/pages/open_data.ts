import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { getSiteSettings } from '../site.js';
import type { DatasetCollection } from '../../export/dataset.js';

const DESCRIPTIONS: Record<DatasetCollection, string> = {
  people: 'Persone',
  families: 'Famiglie e unioni',
  events: 'Eventi (nascite, matrimoni, morti…)',
  places: 'Luoghi',
  sources: 'Fonti (registri, ruoli, lapidi)',
  citations: 'Citazioni: il legame tra un dato e la sua fonte, con i paradati di lettura',
  media: 'Media (descrizioni; i file sono nella cartella media/ del sito)',
  research: 'Registro delle ricerche, anche quelle senza risultato',
};

/** Pagina "Dati": elenco dei file JSON del dataset pubblico, scaricabili da dati/. */
export function renderOpenDataPage(counts: Record<DatasetCollection, number>, rootRelPath: string = './'): string {
  const license = getSiteSettings().datasetLicense;
  const rows = (Object.keys(DESCRIPTIONS) as DatasetCollection[])
    .map((name) => {
      const n = counts[name] ?? 0;
      return `
      <li>
        <div class="registro-data"><a href="${rootRelPath}dati/${name}.json" download>${name}.json</a></div>
        <div class="registro-corpo">
          <div class="registro-titolo">${escapeHtml(DESCRIPTIONS[name])}</div>
          <p class="registro-desc">${n} record</p>
        </div>
      </li>`;
    })
    .join('');

  const content = `
  <header>
    <h1>Dati</h1>
    <p class="sottotitolo">Il dataset di questo sito in JSON, un file per tipo di record. È lo stesso profilo pubblico delle pagine: le persone vive compaiono come "[Living]" con un identificativo pseudonimo, senza date, luoghi, note né media.${license ? ` Licenza: ${escapeHtml(license)}.` : ''}</p>
  </header>
  <div class="sezione">
    <ol class="registro">${rows}
    </ol>
    <p class="muto">Descrizione del formato: <a href="${rootRelPath}dati/README.md">README.md</a>.</p>
  </div>
  `;

  return renderLayout({
    title: 'Dati',
    description: 'Il dataset pubblico dell\'archivio in JSON',
    rootRelPath,
    content,
  });
}
