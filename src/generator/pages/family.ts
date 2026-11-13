import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { Family } from '../../model/family.js';
import { NormalizedDataset } from '../../validator/index.js';
import { fascicolo, serieOf } from '../components/serie.js';
import { cartellino, computeAgeAtEvent, dataIt, eventLabel, nameOf, personLink, renderBreadcrumbs, serieLabel } from '../components/fascicolo.js';
import { getSiteSettings } from '../site.js';
import { formatDate } from '../../model/date.js';

export function renderFamilyPage(
  family: Family,
  dataset: NormalizedDataset,
  rootRelPath: string = '../'
): string {
  const partnerNames = family.partner_ids.map((id) => nameOf(dataset.people.get(id), id));
  const serie = family.partner_ids.map((id) => serieOf(id, dataset)).find((s) => s.index > 0) ?? serieOf(family.partner_ids[0] ?? '', dataset);
  const title = partnerNames.length ? partnerNames.join(' e ') : family.id;

  const partners = family.partner_ids.map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('');

  // Unione: data, luogo e citazioni
  const startEvt = family.start_event_id ? dataset.events.get(family.start_event_id) : undefined;
  const startPlace = startEvt?.place_id ? dataset.places.get(startEvt.place_id) : undefined;
  const startPlaceHtml = startPlace
    ? ` a <a href="${rootRelPath}places/${startPlace.id}.html">${escapeHtml(startPlace.name)}</a>`
    : '';
  const marriageDateStr = startEvt?.date ? dataIt(formatDate(startEvt.date)) : '';

  const endEvt = family.end_event_id ? dataset.events.get(family.end_event_id) : undefined;
  const endPlace = endEvt?.place_id ? dataset.places.get(endEvt.place_id) : undefined;
  const endPlaceHtml = endPlace
    ? ` a <a href="${rootRelPath}places/${endPlace.id}.html">${escapeHtml(endPlace.name)}</a>`
    : '';
  const endDateStr = endEvt?.date ? dataIt(formatDate(endEvt.date)) : '';

  // Figli con dettaglio età genitori e grado di certezza
  const p1 = family.partner_ids[0] ? dataset.people.get(family.partner_ids[0]) : undefined;
  const p2 = family.partner_ids[1] ? dataset.people.get(family.partner_ids[1]) : undefined;
  const p1Birth = p1?.birth_event_id ? dataset.events.get(p1.birth_event_id)?.date : undefined;
  const p2Birth = p2?.birth_event_id ? dataset.events.get(p2.birth_event_id)?.date : undefined;

  const children = (family.children_ids || []).map((childId) => {
    const child = dataset.people.get(childId);
    const childBirth = child?.birth_event_id ? dataset.events.get(child?.birth_event_id)?.date : undefined;
    const conf = family.child_confidence?.[childId];
    let confStr = '';
    if (typeof conf === 'string') {
      confStr = conf !== 'certain' ? conf : '';
    } else if (conf && typeof conf === 'object') {
      confStr = Object.entries(conf)
        .filter(([, v]) => v !== 'certain')
        .map(([pId, v]) => `${pId}: ${v}`)
        .join(', ');
    }
    const tbc = confStr ? ` <span class="timbro">TBC (${escapeHtml(confStr)})</span>` : '';

    const parentAges: string[] = [];
    if (p1 && p1Birth && childBirth) {
      const a = computeAgeAtEvent(p1Birth, childBirth);
      if (a) parentAges.push(`${escapeHtml(p1.given_names ?? 'P1')} ${a}`);
    }
    if (p2 && p2Birth && childBirth) {
      const a = computeAgeAtEvent(p2Birth, childBirth);
      if (a) parentAges.push(`${escapeHtml(p2.given_names ?? 'P2')} ${a}`);
    }
    const ageInfo = parentAges.length ? ` <span class="eta">(${parentAges.join(', ')})</span>` : '';

    return `<li>${personLink(childId, dataset, rootRelPath)}${tbc}${ageInfo}</li>`;
  }).join('');

  // Citazioni comprovanti l'unione
  const unionCitations = [
    ...(family.source_citation_ids || []),
    ...(startEvt?.source_citation_ids || []),
  ];
  const uniqueUnionCit = [...new Set(unionCitations)]
    .map((cId) => dataset.citations.get(cId))
    .filter(Boolean);

  const citazioniUnioneHtml = uniqueUnionCit.length
    ? `<ul class="allegati-lista">${uniqueUnionCit
        .map((cit) => {
          const src = dataset.sources.get(cit!.source_id);
          return `<li><a href="${rootRelPath}sources/${cit!.source_id}.html#cit-${cit!.id}">${escapeHtml(src ? src.title : cit!.source_id)}</a>${cit!.page_or_folio ? `, ${escapeHtml(cit!.page_or_folio)}` : ''}</li>`;
        })
        .join('')}</ul>`
    : '';

  const unrecordedHtml = family.unrecorded_children
    ? `<div class="unrecorded-box"><span class="badge">Altri figli</span> ${escapeHtml(family.unrecorded_children.label || `${family.unrecorded_children.count} figli non documentati individualmente`)}${family.unrecorded_children.note ? `<p class="muto">${escapeHtml(family.unrecorded_children.note)}</p>` : ''}</div>`
    : '';

  const breadcrumb = renderBreadcrumbs([
    { label: 'Archivio', href: `${rootRelPath}index.html` },
    { label: 'Famiglie', href: `${rootRelPath}surnames/index.html` },
    { label: title },
  ]);

  const content = `
  ${breadcrumb}

  <header class="intestazione">
    <div>
      <h1 class="page-title">${escapeHtml(title)}</h1>
      <p class="sottotitolo">Famiglia${family.relationship_type && family.relationship_type !== 'marriage' ? ` · ${escapeHtml(family.relationship_type)}` : ''}</p>
      ${marriageDateStr ? `<p class="estremi">Unione: ${escapeHtml(marriageDateStr)}${startPlaceHtml}</p>` : ''}
      ${endDateStr ? `<p class="muto">Fine: ${escapeHtml(endDateStr)}${endPlaceHtml}</p>` : ''}
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
      <dd>
        ${children ? `<ul>${children}</ul>` : '<span class="muto">nessun figlio registrato</span>'}
        ${unrecordedHtml}
      </dd>
    </dl>
  </section>

  ${citazioniUnioneHtml ? `
  <section class="sezione">
    <h2>Fonti dell'unione</h2>
    ${citazioniUnioneHtml}
  </section>` : ''}

  ${family.notes?.length ? `
  <section class="sezione">
    <h2>Note di ricerca</h2>
    <ul>${family.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>
  </section>` : ''}
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
