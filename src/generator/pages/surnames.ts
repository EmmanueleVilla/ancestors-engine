import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { NormalizedDataset } from '../../validator/index.js';
import { isLiving, personLink } from '../components/fascicolo.js';
import { allSeries } from '../components/serie.js';

export function renderSurnamesIndexPage(dataset: NormalizedDataset, rootRelPath: string = '../'): string {
  const surnameMap = new Map<string, string[]>();
  for (const person of dataset.people.values()) {
    const surname = isLiving(person) ? '[Living]' : (person.surname || '[senza cognome]').trim();
    surnameMap.set(surname, [...(surnameMap.get(surname) || []), person.id]);
  }

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
          const sortedIds = [...ids].sort((a, b) =>
            (dataset.people.get(a)?.given_names || '').localeCompare(dataset.people.get(b)?.given_names || '', 'it')
          );
          return `
          <div class="cognome">
            <h3>${escapeHtml(sur)} <span class="dattilo">${ids.length}</span></h3>
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

  const content = `
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
