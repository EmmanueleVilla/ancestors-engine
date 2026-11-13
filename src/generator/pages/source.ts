import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { Source } from '../../model/source.js';
import { NormalizedDataset } from '../../validator/index.js';
import { eventLabel, isLiving, nameOf, personLink, renderBreadcrumbs, sourceTypeLabel } from '../components/fascicolo.js';
import { isPdfMedia } from '../../model/media.js';

const RELIABILITY: Record<string, string> = { high: 'alta', moderate: 'media', low: 'bassa', uncertain: 'incerta' };

export function renderSourcePage(
  source: Source,
  dataset: NormalizedDataset,
  rootRelPath: string = '../'
): string {
  const citations = [...dataset.citations.values()].filter((c) => c.source_id === source.id);

  const rows: Array<[string, string]> = [
    ['Archivio', source.repository ? escapeHtml(source.repository) : ''],
    ['Collocazione', source.archive_location ? escapeHtml(source.archive_location) : ''],
    ['Fondo', source.collection ? escapeHtml(source.collection) : ''],
    ['Segnatura', source.call_number ? `<span class="dattilo">${escapeHtml(source.call_number)}</span>` : ''],
    ['Autore', source.author ? escapeHtml(source.author) : ''],
    ['Affidabilità', source.reliability ? escapeHtml(RELIABILITY[source.reliability] ?? source.reliability) : ''],
    ['In rete', source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">${escapeHtml(source.url)}</a>` : ''],
  ];

  const claims = citations.length
    ? `<ol class="registro">${citations
        .map((c, i) => {
          let who = '';
          if (c.person_id) {
            who = personLink(c.person_id, dataset, rootRelPath, false);
          } else if (c.family_id) {
            who = `<a href="${rootRelPath}families/${c.family_id}.html">Famiglia ${escapeHtml(c.family_id)}</a>`;
          } else if (c.event_id) {
            const e = dataset.events.get(c.event_id);
            const ps = (e?.person_ids || []).map((id) => personLink(id, dataset, rootRelPath, false)).join(', ');
            who = `${escapeHtml(eventLabel(e?.event_type || 'evento'))}${ps ? ` di ${ps}` : ''}`;
          }
          return `
          <li id="cit-${escapeHtml(c.id)}">
            <div class="registro-data">All. ${i + 1}<span class="tipo">${escapeHtml(c.claim_type.replace(/_/g, ' '))}</span></div>
            <div class="registro-corpo">
              ${who ? `<div class="registro-titolo">${who}</div>` : ''}
              ${c.page_or_folio ? `<p class="registro-desc">${escapeHtml(c.page_or_folio)}</p>` : ''}
              ${c.quoted_text ? `<div class="allegato"><blockquote>${escapeHtml(c.quoted_text)}</blockquote></div>` : ''}
              ${c.confidence && c.confidence !== 'certain' ? '<span class="timbro">Da confermare</span>' : ''}
            </div>
          </li>`;
        })
        .join('')}</ol>`
    : '<p class="muto">Nessuna citazione collegata a questa fonte.</p>';

  const media = [...dataset.media.values()].filter((m) => {
    if (m.source_id !== source.id) return false;
    if (m.person_ids?.some((pid) => isLiving(dataset.people.get(pid)))) return false;
    return true;
  });
  const mediaHtml = media.length
    ? `
    <section class="sezione" aria-labelledby="media-titolo">
      <h2 id="media-titolo">Riproduzioni e scansioni <span class="dattilo muto">${media.length}</span></h2>
      <div class="allegati">
        ${media
          .map((m, i) => {
            const file = m.file_path.split(/[/\\]/).pop() || '';
            const src = `${rootRelPath}media/${file}`;
            const tile = isPdfMedia(m.file_path, m.mime_type)
              ? `<a class="allegati-pdf" href="${src}" target="_blank" rel="noopener"><span class="media-pdf-icon">PDF</span>Apri il documento</a>`
              : `<a class="allegati-foto" href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${escapeHtml(m.title || 'Documento')}" loading="lazy"></a>`;
            return `
            <figure>
              ${tile}
              <figcaption><span class="n etichetta">Doc. ${i + 1}</span>${escapeHtml(m.title || 'Documento')}${m.description ? `<span class="desc">${escapeHtml(m.description)}</span>` : ''}</figcaption>
            </figure>`;
          })
          .join('')}
      </div>
    </section>`
    : '';

  const breadcrumb = renderBreadcrumbs([
    { label: 'Archivio', href: `${rootRelPath}index.html` },
    { label: 'Fonti', href: `${rootRelPath}sources/index.html` },
    { label: source.title },
  ]);

  const content = `
  ${breadcrumb}

  <header class="intestazione">
    <div>
      <h1 class="page-title fonte-titolo">${escapeHtml(source.title)}</h1>
      <p class="sottotitolo">${escapeHtml(sourceTypeLabel(source.source_type))}</p>
    </div>
  </header>

  <section class="sezione">
    <h2>Scheda</h2>
    <dl class="scheda-dati">${rows.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
  </section>

  ${mediaHtml}

  ${source.transcription ? `
  <section class="sezione">
    <h2>Trascrizione</h2>
    <div class="trascrizione">${escapeHtml(source.transcription)}</div>
  </section>` : ''}

  <section class="sezione">
    <h2>Cosa prova <span class="dattilo muto">${citations.length}</span></h2>
    ${claims}
  </section>
  `;

  return renderLayout({
    title: source.title,
    description: `Fonte: ${source.title}`,
    rootRelPath,
    activeNav: 'sources',
    content,
  });
}
