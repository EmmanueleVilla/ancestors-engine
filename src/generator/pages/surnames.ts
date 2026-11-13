import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { NormalizedDataset } from '../../validator/index.js';
import { isLiving, personLink } from '../components/fascicolo.js';
import { allSeries } from '../components/serie.js';
import { Event } from '../../model/event.js';

export function renderSurnamesIndexPage(dataset: NormalizedDataset, rootRelPath: string = '../'): string {
  const surnameMap = new Map<string, string[]>();
  for (const person of dataset.people.values()) {
    const surname = isLiving(person) ? '[Living]' : (person.surname || '[senza cognome]').trim();
    surnameMap.set(surname, [...(surnameMap.get(surname) || []), person.id]);
  }

  // Precompute events per person for time span and top places
  const personEvents = new Map<string, Event[]>();
  for (const ev of dataset.events.values()) {
    for (const pid of ev.person_ids || []) {
      const list = personEvents.get(pid) || [];
      list.push(ev);
      personEvents.set(pid, list);
    }
  }

  const totalPeople = dataset.people.size || 1;
  const sorted = [...surnameMap.keys()].sort((a, b) => a.localeCompare(b, 'it'));
  const letterOf = (s: string) => (s.startsWith('[') ? '#' : s[0].toUpperCase());
  const letters = [...new Set(sorted.map(letterOf))].sort();

  const alfabeto = `
  <nav class="alfabeto no-print" aria-label="Iniziali dei cognomi">
    ${letters.map((l) => `<a href="#lettera-${l === '#' ? 'altro' : l}">${escapeHtml(l)}</a>`).join('')}
  </nav>`;

  const blocks = letters
    .map((letter) => {
      const items = sorted
        .filter((s) => letterOf(s) === letter)
        .map((sur) => {
          const ids = surnameMap.get(sur)!;
          const pct = Math.round((ids.length / totalPeople) * 100);
          const sortedIds = [...ids].sort((a, b) =>
            (dataset.people.get(a)?.given_names || '').localeCompare(dataset.people.get(b)?.given_names || '', 'it')
          );

          const years: number[] = [];
          const placeCounts = new Map<string, number>();

          for (const id of ids) {
            const evs = personEvents.get(id) || [];
            for (const ev of evs) {
              if (ev.date?.year) years.push(ev.date.year);
              if (ev.date?.end_year) years.push(ev.date.end_year);
              if (ev.place_id) {
                placeCounts.set(ev.place_id, (placeCounts.get(ev.place_id) || 0) + 1);
              }
            }
          }

          const timeSpan = years.length
            ? (Math.min(...years) === Math.max(...years) ? `${Math.min(...years)}` : `${Math.min(...years)}–${Math.max(...years)}`)
            : '';

          const topPlaces = [...placeCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([pid]) => {
              const pl = dataset.places.get(pid);
              return pl ? `<a href="${rootRelPath}places/${pid}.html">${escapeHtml(pl.name)}</a>` : '';
            })
            .filter(Boolean);

          return `
          <div class="cognome">
            <h3>${escapeHtml(sur)} <span class="dattilo" title="${ids.length} su ${totalPeople} persone">${ids.length} (${pct}%)</span></h3>
            ${(timeSpan || topPlaces.length) ? `
              <p class="cognome-meta muted" style="font-size:0.85rem; margin:-0.3rem 0 0.5rem">
                ${timeSpan ? `<span class="periodo">Attestazione: <strong>${timeSpan}</strong></span>` : ''}
                ${timeSpan && topPlaces.length ? ' · ' : ''}
                ${topPlaces.length ? `<span class="luoghi">Luoghi: ${topPlaces.join(', ')}</span>` : ''}
              </p>` : ''}
            <ul class="nomi">${sortedIds.map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('')}</ul>
          </div>`;
        })
        .join('');
      return `
      <section class="lettera" id="lettera-${letter === '#' ? 'altro' : letter}">
        <div class="lettera-segno" aria-hidden="true">${escapeHtml(letter)}</div>
        <div>${items}</div>
      </section>`;
    })
    .join('');

  const breadcrumb = `<nav class="briciole" aria-label="Percorso"><a href="${rootRelPath}index.html">Archivio</a> <span class="separatore">/</span> <span>Persone</span></nav>`;

  const content = `
  ${breadcrumb}
  <header>
    <h1 class="sr-only">Persone</h1>
    <p class="sottotitolo">${dataset.people.size} fascicoli in ordine di cognome. Il quadratino colorato indica la serie: ${allSeries(dataset).map((s) => `<span class="legend-swatch ${s.cls}"></span> ${escapeHtml(s.name)}`).join(', ')}${allSeries(dataset).length ? ', ' : ''}<span class="legend-swatch serie-0"></span> fondo generale.</p>
  </header>
  ${alfabeto}
  ${blocks}
  `;

  return renderLayout({
    title: 'Persone',
    description: 'Indice dei cognomi e delle persone dell\'archivio',
    rootRelPath,
    activeNav: 'surnames',
    content,
  });
}
