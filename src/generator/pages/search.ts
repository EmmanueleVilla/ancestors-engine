import { renderLayout } from '../components/layout.js';

export function renderSearchPage(rootRelPath: string = './'): string {
  const content = `
  <header>
    <h1 class="sr-only">Cerca</h1>
    <p class="sottotitolo">Per nome, cognome, anno o luogo.</p>
  </header>
  <label for="search-input" class="etichetta" style="display:block;margin-top:2rem">Cerca nei fascicoli</label>
  <input type="search" id="search-input" class="search-input" style="margin-top:0.25rem" placeholder="per esempio: cognome, anno, luogo" autocomplete="off">
  <div id="search-status" class="muto">Scrivi qualcosa per cercare.</div>

  <section class="sezione" id="results-card" style="display: none;">
    <h2>Risultati <span class="dattilo muto" id="results-count">0</span></h2>
    <ul id="search-results" class="search-results"></ul>
  </section>
  `;

  return renderLayout({
    title: 'Cerca',
    description: 'Ricerca nei fascicoli dell\'archivio',
    rootRelPath,
    activeNav: 'search',
    headExtra: `<script defer src="${rootRelPath}assets/js/search.js"></script>`,
    content,
  });
}
