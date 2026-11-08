import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { NormalizedDataset } from '../../validator/index.js';
import { sourceTypeLabel } from '../components/fascicolo.js';

export function renderSourcesCataloguePage(dataset: NormalizedDataset, rootRelPath: string = '../'): string {
  const sources = [...dataset.sources.values()].sort((a, b) => a.title.localeCompare(b.title, 'it'));
  const citCount = new Map<string, number>();
  for (const c of dataset.citations.values()) citCount.set(c.source_id, (citCount.get(c.source_id) || 0) + 1);

  const groups = new Map<string, typeof sources>();
  for (const s of sources) {
    const k = sourceTypeLabel(s.source_type) || 'Altro';
    groups.set(k, [...(groups.get(k) || []), s]);
  }

  const blocks = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(
      ([label, list]) => `
      <section class="sezione">
        <h2>${escapeHtml(label)} <span class="dattilo muto">${list.length}</span></h2>
        <ol class="schedario">
          ${list
            .map((s) => {
              const n = citCount.get(s.id) || 0;
              return `
              <li>
                <div class="segn">${s.call_number ? escapeHtml(s.call_number) : '<span class="muto">senza segnatura</span>'}</div>
                <div>
                  <h3><a href="${rootRelPath}sources/${s.id}.html">${escapeHtml(s.title)}</a></h3>
                  <p class="dove">${[s.repository, n ? `${n} ${n === 1 ? 'citazione' : 'citazioni'}` : ''].filter(Boolean).map((x) => escapeHtml(x!)).join(' · ')}</p>
                </div>
              </li>`;
            })
            .join('')}
        </ol>
      </section>`
    )
    .join('');

  const content = `
  <header>
    <h1 class="sr-only">Fonti</h1>
    <p class="sottotitolo">Da dove viene ogni dato: registri di stato civile, ruoli matricolari, lapidi, documenti d'archivio.</p>
  </header>
  ${sources.length ? blocks : '<p class="muto">Nessuna fonte registrata.</p>'}
  `;

  return renderLayout({
    title: 'Fonti',
    description: 'Catalogo delle fonti: registri, ruoli matricolari, lapidi',
    rootRelPath,
    activeNav: 'sources',
    content,
  });
}
