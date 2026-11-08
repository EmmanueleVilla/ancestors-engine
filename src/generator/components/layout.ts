import { renderDocument, escapeHtml } from './base.js';
import type { Serie } from './serie.js';
import { getSiteSettings } from '../site.js';

export interface LayoutOptions {
  title: string;
  description?: string;
  rootRelPath?: string;
  activeNav?: 'home' | 'tree' | 'surnames' | 'places' | 'sources' | 'timeline' | 'search' | 'next-steps';
  content: string;
  headExtra?: string;
  /** Serie della pagina: classe serie-N sul body (usata da chi vuole il colore della serie). */
  serie?: Serie;
  /** Pagine larghe (albero): il foglio occupa tutta la larghezza disponibile. */
  wide?: boolean;
}

let showNextSteps = false;
let showOpenData = false;

/** Enables the "Prossimi passi" nav entry (only when the page is generated). */
export function setNextStepsNav(enabled: boolean): void {
  showNextSteps = enabled;
}

/** Enables the "Scarica i dati" footer link (only when dati.html is generated). */
export function setOpenDataLink(enabled: boolean): void {
  showOpenData = enabled;
}

export function renderLayout(options: LayoutOptions): string {
  const root = options.rootRelPath ?? './';
  const active = options.activeNav;
  const serieCls = options.serie?.cls ?? 'serie-0';
  const site = getSiteSettings();
  const treeHref = site.rootPersonId ? `${root}trees/${site.rootPersonId}.html` : `${root}surnames/index.html`;

  const navItems = [
    { id: 'tree', label: 'Albero', href: treeHref },
    { id: 'surnames', label: 'Persone', href: `${root}surnames/index.html` },
    { id: 'places', label: 'Luoghi', href: `${root}places/index.html` },
    { id: 'sources', label: 'Fonti', href: `${root}sources/index.html` },
    { id: 'timeline', label: 'Cronologia', href: `${root}timeline.html` },
    { id: 'search', label: 'Cerca', href: `${root}search.html` },
    ...(showNextSteps ? [{ id: 'next-steps', label: 'Prossimi passi', href: `${root}next-steps.html` }] : []),
  ];

  const navLinks = navItems
    .map(
      (item) =>
        `<li><a href="${item.href}"${active === item.id ? ' class="active" aria-current="page"' : ''}>${item.label}</a></li>`
    )
    .join('');

  const bodyContent = `
  <a class="salta" href="#contenuto">Vai al contenuto</a>
  <header class="barra">
    <div class="barra-inner">
      <a class="fondo-nome" href="${root}index.html"${active === 'home' ? ' aria-current="page"' : ''}>
        <span class="fondo-titolo">${escapeHtml(site.title)}</span>
        <span class="fondo-sotto">${escapeHtml(site.subtitle)}</span>
      </a>
      <button type="button" class="menu-btn" aria-expanded="false" aria-controls="nav-principale" aria-label="Apri il menu">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>
      </button>
      <nav id="nav-principale" aria-label="Sezioni dell'archivio">
        <ul class="nav-lista">${navLinks}</ul>
      </nav>
    </div>
  </header>
  <main id="contenuto" class="scrivania${options.wide ? ' scrivania-larga' : ''}">
    <div class="foglio">
      ${options.content}
    </div>
  </main>
  <footer class="piede">
    <p>${escapeHtml(site.footer)}</p>${showOpenData ? `
    <p><a href="${root}dati.html">Scarica i dati (JSON)</a></p>` : ''}
  </footer>
  `;

  return renderDocument({
    title: options.title,
    description: options.description,
    rootRelPath: root,
    headExtra: options.headExtra,
    bodyContent,
    bodyClass: `${serieCls}${options.wide ? ' larga' : ''}`,
  });
}
