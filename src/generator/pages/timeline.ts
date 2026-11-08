import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { formatDate, getDateSortKey } from '../../model/date.js';
import { NormalizedDataset } from '../../validator/index.js';
import { dataIt, eventLabel, personLink } from '../components/fascicolo.js';

export function renderTimelinePage(dataset: NormalizedDataset, rootRelPath: string = './'): string {
  const events = [...dataset.events.values()].sort((a, b) => getDateSortKey(a.date).localeCompare(getDateSortKey(b.date)));

  // Raggruppa per decennio
  const byDecade = new Map<string, typeof events>();
  for (const e of events) {
    const y = e.date?.year;
    const k = y ? `${Math.floor(y / 10) * 10}` : 'Senza data';
    byDecade.set(k, [...(byDecade.get(k) || []), e]);
  }

  const blocks = [...byDecade.entries()]
    .map(([decade, list]) => `
    <section class="lettera" id="anni-${escapeHtml(decade)}">
      <div class="lettera-segno" aria-hidden="true" style="font-size:2.2rem">${escapeHtml(decade)}</div>
      <ol class="registro">
        ${list
          .map((e) => {
            const place = e.place_id ? dataset.places.get(e.place_id) : undefined;
            const who = (e.person_ids || []).map((id) => personLink(id, dataset, rootRelPath, false)).join(', ');
            const stimata = e.date?.precision === 'estimated' || e.date?.precision === 'approximate';
            const dateTxt = stimata && e.date?.year ? String(e.date.year) : dataIt(formatDate(e.date)) || 's.d.';
            const desc = (e.description || '').replace(/\s*\((stimata|stimato)\)\s*$/i, '');
            return `
            <li>
              <div class="registro-data">${escapeHtml(dateTxt)}<span class="tipo">${escapeHtml(eventLabel(e.event_type))}</span></div>
              <div class="registro-corpo">
                <div class="registro-titolo">${who || escapeHtml(eventLabel(e.event_type))}${place ? ` <span class="muto">a</span> <a href="${rootRelPath}places/${place.id}.html">${escapeHtml(place.name)}</a>` : ''}${stimata ? '<span class="timbro">Stimato</span>' : ''}</div>
                ${desc ? `<p class="registro-desc">${escapeHtml(desc)}</p>` : ''}
              </div>
            </li>`;
          })
          .join('')}
      </ol>
    </section>`)
    .join('');

  const content = `
  <header>
    <h1 class="sr-only">Cronologia</h1>
    <p class="sottotitolo">${events.length} eventi in ordine di tempo, raggruppati per decennio.</p>
  </header>
  <div class="sezione cronologia">${blocks || '<p class="muto">Nessun evento registrato.</p>'}</div>
  `;

  return renderLayout({
    title: 'Cronologia',
    description: 'Cronologia della famiglia: nascite, matrimoni, morti',
    rootRelPath,
    activeNav: 'timeline',
    content,
  });
}
