import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { Place } from '../../model/place.js';
import { formatDate } from '../../model/date.js';
import { NormalizedDataset } from '../../validator/index.js';
import { dataIt, eventLabel, personLink, renderBreadcrumbs } from '../components/fascicolo.js';
import { placeTypeLabel } from './places.js';

export function renderPlacePage(
  place: Place,
  dataset: NormalizedDataset,
  rootRelPath: string = '../'
): string {
  const events = [...dataset.events.values()]
    .filter((e) => e.place_id === place.id)
    .sort((a, b) => (a.date?.year || 0) - (b.date?.year || 0));

  const bornHere = new Set<string>();
  const diedHere = new Set<string>();
  const marriedHere = new Set<string>();
  const otherHere = new Set<string>();

  for (const e of events) {
    for (const pid of e.person_ids || []) {
      const p = dataset.people.get(pid);
      if (p?.birth_event_id === e.id || e.event_type === 'birth' || e.event_type === 'baptism') {
        bornHere.add(pid);
      } else if (p?.death_event_id === e.id || p?.burial_event_id === e.id || e.event_type === 'death' || e.event_type === 'burial') {
        diedHere.add(pid);
      } else if (e.event_type === 'marriage' || e.event_type === 'civil_union') {
        marriedHere.add(pid);
      } else {
        otherHere.add(pid);
      }
    }
  }

  const allPeopleCount = new Set([...bornHere, ...diedHere, ...marriedHere, ...otherHere]).size;

  const parent = place.parent_place_id ? dataset.places.get(place.parent_place_id) : undefined;
  const area = [place.administrative_area, place.country].filter(Boolean).join(', ');

  const geoBox = typeof place.latitude === 'number' && typeof place.longitude === 'number'
    ? `<div class="coordinate-box">
         <span>Lat. ${place.latitude.toFixed(4)}, Lon. ${place.longitude.toFixed(4)}</span> ·
         <a href="https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=14/${place.latitude}/${place.longitude}" target="_blank" rel="noopener">Visualizza su OpenStreetMap</a>
       </div>`
    : '';

  const registro = events.length
    ? `<ol class="registro">${events
        .map((e) => {
          const who = (e.person_ids || []).map((id) => personLink(id, dataset, rootRelPath, false)).join(', ');
          return `
          <li id="evt-${escapeHtml(e.id)}">
            <div class="registro-data">${escapeHtml(dataIt(formatDate(e.date)) || 's.d.')}<span class="tipo">${escapeHtml(eventLabel(e.event_type))}</span></div>
            <div class="registro-corpo">
              ${who ? `<div class="registro-titolo">${who}</div>` : ''}
              ${e.description ? `<p class="registro-desc">${escapeHtml(e.description)}</p>` : ''}
            </div>
          </li>`;
        })
        .join('')}</ol>`
    : '<p class="muto">Nessun evento registrato in questo luogo.</p>';

  const breadcrumb = renderBreadcrumbs([
    { label: 'Archivio', href: `${rootRelPath}index.html` },
    { label: 'Luoghi', href: `${rootRelPath}places/index.html` },
    ...(parent ? [{ label: parent.name, href: `${rootRelPath}places/${parent.id}.html` }] : []),
    { label: place.name },
  ]);

  const content = `
  ${breadcrumb}

  <header class="intestazione">
    <div>
      <h1 class="page-title">${escapeHtml(place.name)}</h1>
      ${place.place_type ? `<p class="sottotitolo">${escapeHtml(placeTypeLabel(place.place_type).replace(/^./, (c) => c.toUpperCase()))}</p>` : ''}
      ${place.historical_name ? `<p class="sottotitolo">un tempo ${escapeHtml(place.historical_name)}</p>` : ''}
      ${parent ? `<p class="sottotitolo">in <a href="${rootRelPath}places/${parent.id}.html">${escapeHtml(parent.name)}</a></p>` : area ? `<p class="sottotitolo">${escapeHtml(area)}</p>` : ''}
      ${geoBox}
    </div>
  </header>

  <section class="sezione">
    <h2>Persone <span class="dattilo muto">${allPeopleCount}</span></h2>
    ${bornHere.size ? `<div class="sottosezione-muto">Nati a ${escapeHtml(place.name)}:</div><ul class="nomi">${[...bornHere].map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('')}</ul>` : ''}
    ${diedHere.size ? `<div class="sottosezione-muto">Deceduti o sepolti a ${escapeHtml(place.name)}:</div><ul class="nomi">${[...diedHere].map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('')}</ul>` : ''}
    ${marriedHere.size ? `<div class="sottosezione-muto">Uniti in matrimonio a ${escapeHtml(place.name)}:</div><ul class="nomi">${[...marriedHere].map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('')}</ul>` : ''}
    ${otherHere.size ? `<div class="sottosezione-muto">Altri collegamenti:</div><ul class="nomi">${[...otherHere].map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('')}</ul>` : ''}
    ${!allPeopleCount ? '<p class="muto">Nessuna persona collegata a questo luogo.</p>' : ''}
  </section>

  <section class="sezione">
    <h2>Registro <span class="dattilo muto">${events.length}</span></h2>
    ${registro}
  </section>
  `;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: place.name,
    ...(typeof place.latitude === 'number' && typeof place.longitude === 'number'
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: place.latitude,
            longitude: place.longitude,
          },
        }
      : {}),
  };

  return renderLayout({
    title: place.name,
    description: `Persone ed eventi a ${place.name}`,
    rootRelPath,
    activeNav: 'places',
    jsonLd,
    content,
  });
}
