import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { Person, getPersonDisplayName } from '../../model/person.js';
import { extractTreeGraphData, buildAncestorBranch, buildDescendantBranch } from '../components/tree.js';
import { NormalizedDataset } from '../../validator/index.js';
import { allSeries, serieOf } from '../components/serie.js';
import { renderBreadcrumbs } from '../components/fascicolo.js';

export interface TreeLayout {
  rootId?: string;
  mirrorRootId?: string;
  positions?: Record<string, { x: number; y: number }>;
}

export function renderTreePage(
  person: Person,
  dataset: NormalizedDataset,
  rootRelPath: string = '../',
  layout: TreeLayout = {}
): string {
  const isLiving = person.privacy === 'living-person restricted';
  const name = isLiving ? '[Living]' : getPersonDisplayName(person);

  const graphData = extractTreeGraphData(person.id, dataset, rootRelPath);
  // Posizioni manuali solo per i nodi presenti in questo albero.
  const nodeIds = new Set((graphData.nodes || []).map((n: { id: string }) => n.id));
  const positions = Object.fromEntries(Object.entries(layout.positions ?? {}).filter(([id]) => nodeIds.has(id)));
  const graphJson = JSON.stringify({
    ...graphData,
    layout: {
      rootId: layout.rootId && nodeIds.has(layout.rootId) ? layout.rootId : undefined,
      mirrorRootId: layout.mirrorRootId && nodeIds.has(layout.mirrorRootId) ? layout.mirrorRootId : undefined,
      positions,
    },
  });


  const serie = serieOf(person.id, dataset);
  const series = allSeries(dataset);
  const serieLegend = series
    .map((s) => `<span class="legend-chip"><span class="legend-swatch ${s.cls}"></span>${escapeHtml(s.name)}</span>`)
    .join('');

  const breadcrumb = renderBreadcrumbs([
    { label: 'Archivio', href: `${rootRelPath}index.html` },
    { label: name, href: `${rootRelPath}people/${person.id}.html` },
    { label: 'Albero' },
  ]);

  const content = `
  <header class="tree-head">
    ${breadcrumb}
    <h1 class="sr-only">Albero di ${escapeHtml(name)}</h1>
  </header>

  <section id="tree-canvas-section" class="tree-canvas-card">
    <div class="canvas-toolbar">
      <div class="toolbar-group">
        <button type="button" id="btn-zoom-in" class="btn btn-sm" title="Ingrandisci" aria-label="Ingrandisci">+</button>
        <button type="button" id="btn-zoom-out" class="btn btn-sm" title="Rimpicciolisci" aria-label="Rimpicciolisci">−</button>
        <button type="button" id="btn-fit-all" class="btn btn-sm" title="Mostra tutto l'albero">Tutto</button>
        <button type="button" id="btn-reset-zoom" class="btn btn-sm" title="Torna alla persona al centro">Centra</button>
        <button type="button" id="btn-fullscreen" class="btn btn-sm" title="Schermo intero" aria-label="Schermo intero">Schermo intero</button>
      </div>
      <button type="button" id="btn-export-png" class="btn btn-sm btn-primary" title="Salva l'albero come immagine">Salva immagine</button>
    </div>

    <div class="canvas-wrapper">
      <canvas id="tree-canvas" aria-label="Albero genealogico interattivo di ${escapeHtml(name)}"></canvas>
      <div class="canvas-hint">Trascina per spostare · rotella o due dita per ingrandire · clicca una scheda, un anello o una freccia per vedere i documenti</div>

      <div id="marriage-modal" class="marriage-modal-overlay" style="display: none;">
        <div class="marriage-modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-marriage-title">
          <div class="marriage-modal-header">
            <div>
              <span id="modal-icon"></span>
              <h2 id="modal-marriage-title">Unione</h2>
              <div id="modal-marriage-subtitle"></div>
            </div>
            <button type="button" class="marriage-modal-close" aria-label="Chiudi">✕</button>
          </div>

          <div class="marriage-modal-body">
            <div id="modal-marriage-meta" class="marriage-meta-grid"></div>

            <div id="modal-marriage-pending-box" class="pending-box" style="display: none;">
              <div class="pending-box-title">Richiesta in corso</div>
              <ul id="modal-marriage-pending-list" class="pending-list"></ul>
            </div>

            <div id="modal-marriage-notes-box" class="modal-note" style="display: none;">
              <div id="modal-marriage-notes"></div>
            </div>

            <div id="modal-marriage-source-box" class="source-box" style="display: none;">
              <div class="source-box-head">
                <span class="etichetta">Atto</span>
                <span id="modal-source-callnumber" class="callnumber"></span>
              </div>
              <div id="modal-source-title" class="source-box-title"></div>
              <div id="modal-source-page" class="source-box-page"></div>
              <div class="source-box-actions">
                <a id="modal-source-portal-link" href="#" target="_blank" rel="noopener" class="btn btn-sm btn-primary" style="display: none;">Apri l'originale</a>
                <a id="modal-source-local-link" href="#" class="btn btn-sm" style="display: none;">Scheda della fonte</a>
              </div>
            </div>

            <div id="modal-link-sources" style="display: none;"></div>

            <div id="modal-marriage-media-box" style="display: none;">
              <div class="media-box-title">Scansioni</div>
              <div id="modal-marriage-media-list" class="marriage-media-list"></div>
            </div>

            <div id="modal-marriage-no-source" class="no-source" style="display: none;">
              Nessuna fonte archiviata per questa unione.
            </div>

            <div id="modal-marriage-research-box" class="research-box" style="display: none;">
              <div class="research-box-title">Ricerche fatte</div>
              <ul id="modal-marriage-research-list" class="research-list"></ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    <details class="legenda" id="legenda" open>
    <summary>Legenda</summary>
    <div class="toolbar-legend">
      ${serieLegend}
      <span class="legend-chip"><span class="legend-line"></span>Linea diretta</span>
      <span class="legend-chip"><span class="legend-line tbc"></span>Da confermare</span>
      <span class="legend-chip"><span class="legend-box">?</span>Genitori da trovare</span>
      <span class="legend-chip found-in" title="Il nome compare in: atto di nascita"><svg class="found-in-icon" viewBox="0 -960 960 960" aria-hidden="true"><path fill="#1c1b19" d="M584-502q19 0 32-13t13-32q0-19-13-32t-32-13q-19 0-32 13t-13 32q0 19 13 32t32 13Zm-209 0q19 0 32-13t13-32q0-19-13-32t-32-13q-19 0-32 13t-13 32q0 19 13 32t32 13Zm105 216q54 0 101-29t73-80H306q26 51 73 80t101 29Zm0 166q-74 0-139.5-28.5T226-226q-49-49-77.5-114.5T120-480q0-74 28.5-139.5T226-734q49-49 114.5-77.5T480-840q74 0 139.5 28.5T734-734q49 49 77.5 114.5T840-480q0 74-28.5 139.5T734-226q-49 49-114.5 77.5T480-120Zm15-518q29 0 44-8.5t15-24.5q0-9-6.5-14.5T530-691q-7 0-15 1.5t-20 1.5q-25 0-41.5-16.5T437-746q0-10 1.5-20.5T442-784q-14 2-26 4.5t-26 7.5q-2 5-2.5 12.5T387-746q0 46 31 77t77 31Z"/></svg> Atto di nascita</span>
        <span class="legend-chip found-in" title="Il nome compare in: matrimonio"><svg class="found-in-icon" viewBox="0 -960 960 960" aria-hidden="true"><path fill="#1c1b19" d="M480-140q-11 0-22-4t-19-12l-53-49Q262-320 171-424.5T80-643q0-90 60.5-150.5T290-854q51 0 101 24.5t89 80.5q44-56 91-80.5t99-24.5q89 0 149.5 60.5T880-643q0 114-91 218.5T574-205l-53 49q-8 8-19 12t-22 4Z"/></svg> Matrimonio</span>
        <span class="legend-chip found-in" title="Il nome compare in: morte / lapide"><svg class="found-in-icon" viewBox="0 -960 960 960" aria-hidden="true"><path fill="#1c1b19" d="M440-80q-100 0-170-70t-70-170v-80q71-1 134 29t106 81v-152q-86-14-143-81t-57-157v-157q0-20 18-28t32 5l90 78 77-93q9-11 23-11t23 11l77 93 90-78q14-13 32-5t18 28v157q0 90-57 157t-143 81v152q43-51 106-81t134-29v80q0 100-70 170T520-80h-80Z"/></svg> Morte / lapide</span>
        <span class="legend-chip found-in" title="Il nome compare in: foglio matricolare"><svg class="found-in-icon" viewBox="0 -960 960 960" aria-hidden="true"><path fill="#1c1b19" d="m480-161-73 54q-9 7-17.5.5T384-124l28-90-73-54q-9-7-5.5-17t14.5-10h90l25-97-140-82q-20-12-31.5-31T280-547v-273q0-25 17.5-42.5T340-880h280q25 0 42.5 17.5T680-820v273q0 23-11.5 42T637-474l-141 82 26 97h89q11 0 14.5 10t-5.5 17l-73 54 28 90q3 11-5.5 17t-17.5-1l-72-53Zm-26-659v350l30 16 30-16v-350h-60Z"/></svg> Foglio matricolare</span>
    </div>
    </details>
  </section>

  <details class="albero-accessibile no-print">
    <summary>Visualizzazione testuale accessibile (antenati e discendenti)</summary>
    <div class="albero-accessibile-contenuto">
      <div class="albero-sezione">
        <h3 class="albero-sezione-titolo">Antenati</h3>
        ${buildAncestorBranch(person.id, dataset, 0, 4, rootRelPath)}
      </div>
      <div class="albero-sezione">
        <h3 class="albero-sezione-titolo">Discendenti</h3>
        ${buildDescendantBranch(person.id, dataset, 0, 3, rootRelPath)}
      </div>
    </div>
  </details>

  <script id="tree-data" type="application/json">
    ${graphJson}
  </script>
  `;

  return renderLayout({
    title: `Albero di ${name}`,
    serie,
    wide: true,
    activeNav: 'tree',
    description: `Albero genealogico visivo di ${name}`,
    rootRelPath,
    headExtra: `<script defer src="${rootRelPath}assets/js/tree.js"></script>`,
    content,
  });
}
