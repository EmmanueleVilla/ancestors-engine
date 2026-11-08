import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { Family } from '../../model/family.js';
import { NormalizedDataset } from '../../validator/index.js';
import { fascicolo, serieOf } from '../components/serie.js';
import { cartellino, nameOf, personLink, serieLabel } from '../components/fascicolo.js';
import { getSiteSettings } from '../site.js';

export function renderFamilyPage(
  family: Family,
  dataset: NormalizedDataset,
  rootRelPath: string = '../'
): string {
  const partnerNames = family.partner_ids.map((id) => nameOf(dataset.people.get(id), id));
  const serie = family.partner_ids.map((id) => serieOf(id, dataset)).find((s) => s.index > 0) ?? serieOf(family.partner_ids[0] ?? '', dataset);
  const title = partnerNames.length ? partnerNames.join(' e ') : family.id;

  const partners = family.partner_ids.map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('');
  const children = (family.children_ids || []).map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('');

  const content = `
  <header class="intestazione">
    <div>
      <h1 class="page-title">${escapeHtml(title)}</h1>
      <p class="sottotitolo">Famiglia</p>
      ${family.relationship_type && family.relationship_type !== 'marriage' ? `<p class="sottotitolo">${escapeHtml(family.relationship_type)}</p>` : ''}
    </div>
    ${cartellino([
      ['Fondo', escapeHtml(getSiteSettings().title)],
      ['Serie', serieLabel(serie)],
      ['Famiglia', `n. ${escapeHtml(fascicolo(family.id))}`],
    ])}
  </header>

  <section class="sezione">
    <h2>Legami</h2>
    <dl class="legami">
      <dt>Coniugi</dt>
      <dd>${partners ? `<ul>${partners}</ul>` : '<span class="muto">non registrati</span>'}</dd>
      <dt>Figli</dt>
      <dd>${children ? `<ul>${children}</ul>` : '<span class="muto">nessun figlio registrato</span>'}</dd>
    </dl>
  </section>
  `;

  return renderLayout({
    title,
    description: `Famiglia ${title}`,
    rootRelPath,
    activeNav: 'surnames',
    serie,
    content,
  });
}
