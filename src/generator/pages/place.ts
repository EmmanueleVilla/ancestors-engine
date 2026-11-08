import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { Place } from '../../model/place.js';
import { formatDate } from '../../model/date.js';
import { NormalizedDataset } from '../../validator/index.js';
import { dataIt, eventLabel, personLink } from '../components/fascicolo.js';
import { placeTypeLabel } from './places.js';

export function renderPlacePage(
  place: Place,
  dataset: NormalizedDataset,
  rootRelPath: string = '../'
): string {
  const events = [...dataset.events.values()]
    .filter((e) => e.place_id === place.id)
    .sort((a, b) => (a.date?.year || 0) - (b.date?.year || 0));

  const peopleIds = new Set<string>();
  for (const e of events) (e.person_ids || []).forEach((id) => peopleIds.add(id));

  const parent = place.parent_place_id ? dataset.places.get(place.parent_place_id) : undefined;
  const area = [place.administrative_area, place.country].filter(Boolean).join(', ');

  const registro = events.length
    ? `<ol class="registro">${events
        .map((e) => {
          const who = (e.person_ids || []).map((id) => personLink(id, dataset, rootRelPath, false)).join(', ');
          return `
          <li>
            <div class="registro-data">${escapeHtml(dataIt(formatDate(e.date)) || 's.d.')}<span class="tipo">${escapeHtml(eventLabel(e.event_type))}</span></div>
            <div class="registro-corpo">
              ${who ? `<div class="registro-titolo">${who}</div>` : ''}
              ${e.description ? `<p class="registro-desc">${escapeHtml(e.description)}</p>` : ''}
            </div>
          </li>`;
        })
        .join('')}</ol>`
    : '<p class="muto">Nessun evento registrato in questo luogo.</p>';

  const content = `
  <header class="intestazione">
    <div>
      <h1 class="page-title">${escapeHtml(place.name)}</h1>
      ${place.place_type ? `<p class="sottotitolo">${escapeHtml(placeTypeLabel(place.place_type).replace(/^./, (c) => c.toUpperCase()))}</p>` : ''}
      ${place.historical_name ? `<p class="sottotitolo">un tempo ${escapeHtml(place.historical_name)}</p>` : ''}
      ${parent ? `<p class="sottotitolo">in <a href="${rootRelPath}places/${parent.id}.html">${escapeHtml(parent.name)}</a></p>` : area ? `<p class="sottotitolo">${escapeHtml(area)}</p>` : ''}
    </div>
  </header>

  <section class="sezione">
    <h2>Persone <span class="dattilo muto">${peopleIds.size}</span></h2>
    ${peopleIds.size ? `<ul class="nomi">${[...peopleIds].map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('')}</ul>` : '<p class="muto">Nessuna persona collegata a questo luogo.</p>'}
  </section>

  <section class="sezione">
    <h2>Registro <span class="dattilo muto">${events.length}</span></h2>
    ${registro}
  </section>
  `;

  return renderLayout({
    title: place.name,
    description: `Persone ed eventi a ${place.name}`,
    rootRelPath,
    activeNav: 'places',
    content,
  });
}
