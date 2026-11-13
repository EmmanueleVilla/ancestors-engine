import { isPdfMedia } from '../../model/media.js';
import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { Person } from '../../model/person.js';
import { formatDate } from '../../model/date.js';
import { NormalizedDataset } from '../../validator/index.js';
import { serieOf } from '../components/serie.js';
import { computeAgeAtEvent, dataIt, eventLabel, nameOf, personLink, personSegnatura, renderBreadcrumbs } from '../components/fascicolo.js';
import { surnameAnchorId } from './surnames.js';

const CONFIDENCE_IT: Record<string, string> = {
  probable: 'probabile',
  possible: 'possibile',
  estimated: 'stimato',
  unknown: 'ignoto',
};

export function renderPersonPage(
  person: Person,
  dataset: NormalizedDataset,
  rootRelPath: string = '../'
): string {
  const isLiving = person.privacy === 'living-person restricted';
  const displayName = isLiving ? '[Living]' : nameOf(person);
  const serie = serieOf(person.id, dataset);

  // Genitori
  const parentRels = dataset.relationships.filter(
    (r) => r.related_person_id === person.id && r.relationship_type.endsWith('_parent')
  );
  const parentsHtml = parentRels.length
    ? `<ul>${parentRels
        .map((r) => {
          const type = r.relationship_type !== 'biological_parent'
            ? ` <span class="badge">${escapeHtml(r.relationship_type.replace('_parent', '').replace(/_/g, ' '))}</span>`
            : '';
          const tbc = r.confidence && r.confidence !== 'certain'
            ? `<span class="timbro" title="Legame non ancora provato (${escapeHtml(CONFIDENCE_IT[r.confidence] ?? r.confidence)})">TBC</span>`
            : '';
          return `<li>${personLink(r.person_id, dataset, rootRelPath)}${type}${tbc}</li>`;
        })
        .join('')}</ul>`
    : '<span class="muto">non ancora trovati</span>';

  // Unioni e figli
  const personFamilies = [...dataset.families.values()].filter((f) => f.partner_ids?.includes(person.id));
  const unioniHtml = personFamilies
    .map((fam) => {
      const others = fam.partner_ids.filter((id) => id !== person.id);
      const partner = others.length
        ? others.map((id) => personLink(id, dataset, rootRelPath)).join(', ')
        : '<span class="muto">coniuge non registrato</span>';
      const kids = fam.children_ids?.length
        ? `<ul>${fam.children_ids.map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('')}</ul>`
        : '<span class="muto">nessun figlio registrato</span>';
      return `
        <dt>Coniuge</dt>
        <dd><ul><li>${partner}<a class="via" href="${rootRelPath}families/${fam.id}.html">famiglia</a></li></ul></dd>
        <dt>Figli</dt>
        <dd>${kids}</dd>`;
    })
    .join('');

  // Fratelli e sorelle
  const parentIds = new Set(parentRels.map((r) => r.person_id));
  const fullSiblings = new Set<string>();
  const halfSiblings = new Set<string>();

  if (parentIds.size > 0) {
    for (const fam of dataset.families.values()) {
      const famPartners = fam.partner_ids ?? [];
      const sharedParents = famPartners.filter((p) => parentIds.has(p));
      if (sharedParents.length > 0) {
        for (const childId of fam.children_ids ?? []) {
          if (childId === person.id) continue;
          if (sharedParents.length >= 2 || (parentIds.size === 1 && sharedParents.length === 1)) {
            fullSiblings.add(childId);
          } else {
            halfSiblings.add(childId);
          }
        }
      }
    }
  }
  for (const fs of fullSiblings) halfSiblings.delete(fs);

  const siblingsHtml = fullSiblings.size > 0 || halfSiblings.size > 0
    ? `
      <dt>Fratelli e sorelle</dt>
      <dd>
        ${fullSiblings.size > 0 ? `<ul>${[...fullSiblings].map((id) => `<li>${personLink(id, dataset, rootRelPath)}</li>`).join('')}</ul>` : ''}
        ${halfSiblings.size > 0 ? `<div class="legami-sottotitolo">Fratellastri / sorellastre:</div><ul>${[...halfSiblings].map((id) => `<li>${personLink(id, dataset, rootRelPath)} <span class="badge">unilaterale</span></li>`).join('')}</ul>` : ''}
      </dd>`
    : '';

  // Estremi: nascita e morte
  const birth = person.birth_event_id ? dataset.events.get(person.birth_event_id) : undefined;
  const death = person.death_event_id ? dataset.events.get(person.death_event_id) : undefined;
  const placeName = (id?: string) => (id ? dataset.places.get(id)?.name : undefined);
  const evText = (e: typeof birth, mark: string, extra = '') => {
    if (!e) return '';
    const pl = placeName(e.place_id);
    const placeLink = pl
      ? `, <a href="${rootRelPath}places/${e.place_id}.html" class="link-luogo">${escapeHtml(pl)}</a>`
      : '';
    return `${mark} ${dataIt(formatDate(e.date)) || 's.d.'}${placeLink}${extra ? ` <span class="eta">${escapeHtml(extra)}</span>` : ''}`;
  };
  const ageAtDeath = computeAgeAtEvent(birth?.date, death?.date);
  const estremi = isLiving
    ? ''
    : [
        birth ? `<span>${evText(birth, 'n.')}</span>` : '',
        death ? `<span class="croce">${evText(death, '†', ageAtDeath ? `(${ageAtDeath})` : '')}</span>` : '',
      ]
        .filter(Boolean)
        .join('');

  // Registro degli eventi, con allegati numerati
  let allegatoN = 0;
  const personEvents = [...dataset.events.values()]
    .filter((e) => e.person_ids?.includes(person.id))
    .sort((a, b) => (a.date?.year || 0) - (b.date?.year || 0));

  const registroHtml = isLiving
    ? '<p class="muto">Dati non pubblicati: persona vivente.</p>'
    : personEvents.length
    ? `<ol class="registro">${personEvents
        .map((e) => {
          const place = e.place_id ? dataset.places.get(e.place_id) : undefined;
          const ageStr = e.id !== person.birth_event_id && birth?.date ? computeAgeAtEvent(birth.date, e.date) : '';
          const cits = (e.source_citation_ids || [])
            .map((cId) => {
              const cit = dataset.citations.get(cId);
              if (!cit) return '';
              const src = dataset.sources.get(cit.source_id);
              allegatoN++;
              return `
              <div class="allegato">
                <div class="allegato-rif"><span class="n">All. ${allegatoN}</span><a href="${rootRelPath}sources/${cit.source_id}.html#cit-${cit.id}">${escapeHtml(src ? src.title : cit.source_id)}</a>${cit.page_or_folio ? `, ${escapeHtml(cit.page_or_folio)}` : ''}</div>
                ${cit.quoted_text ? `<blockquote>${escapeHtml(cit.quoted_text)}</blockquote>` : ''}
              </div>`;
            })
            .join('');
          return `
          <li id="evt-${escapeHtml(e.id)}">
            <div class="registro-data">${escapeHtml(dataIt(formatDate(e.date)) || 's.d.')}${ageStr ? `<span class="eta">${escapeHtml(ageStr)}</span>` : ''}<span class="tipo">${escapeHtml(eventLabel(e.event_type))}</span></div>
            <div class="registro-corpo">
              <div class="registro-titolo">${escapeHtml(eventLabel(e.event_type))}${place ? ` a <a href="${rootRelPath}places/${place.id}.html">${escapeHtml(place.name)}</a>` : ''}${e.date?.precision === 'estimated' || e.date?.precision === 'approximate' || e.confidence === 'estimated' ? '<span class="timbro">Stimato</span>' : e.confidence && e.confidence !== 'certain' ? '<span class="timbro">Da confermare</span>' : ''}</div>
              ${e.description ? `<p class="registro-desc">${escapeHtml(e.description)}</p>` : ''}
              ${cits}
            </div>
          </li>`;
        })
        .join('')}</ol>`
    : '<p class="muto">Nessun evento registrato.</p>';

  // Allegati fotografici
  const mediaIds = [
    ...(person.media_ids || []),
    ...[...dataset.media.values()]
      .filter((m) => (m.person_ids || []).includes(person.id))
      .sort((a, b) => (a.date_created?.year ?? 0) - (b.date_created?.year ?? 0))
      .map((m) => m.id),
  ];
  const media = [...new Set(mediaIds)].map((id) => dataset.media.get(id)).filter(Boolean);
  const allegatiHtml = media.length
    ? `
    <section class="sezione" aria-labelledby="doc-titolo">
      <h2 id="doc-titolo">Documenti <span class="dattilo muto">${media.length}</span></h2>
      <div class="allegati">
        ${media
          .map((m, i) => {
            const file = m!.file_path.split(/[/\\]/).pop() || '';
            const src = `${rootRelPath}media/${file}`;
            const tile = isPdfMedia(m!.file_path, m!.mime_type)
              ? `<a class="allegati-pdf" href="${src}" target="_blank" rel="noopener"><span class="media-pdf-icon">PDF</span>Apri il documento</a>`
              : `<a class="allegati-foto" href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="${escapeHtml(m!.title || 'Documento')}" loading="lazy"></a>`;
            return `
            <figure>
              ${tile}
              <figcaption><span class="n etichetta">Doc. ${i + 1}</span>${escapeHtml(m!.title || 'Documento')}${m!.description ? `<span class="desc">${escapeHtml(m!.description)}</span>` : ''}</figcaption>
            </figure>`;
          })
          .join('')}
      </div>
    </section>`
    : '';

  const occupations = !isLiving && person.occupations?.length ? person.occupations.join(', ') : '';
  const notes = !isLiving ? person.notes || [] : [];
  const nextStep = !isLiving && person.parents_next_step && parentRels.length < 2 ? person.parents_next_step : '';

  const breadcrumb = renderBreadcrumbs([
    { label: 'Archivio', href: `${rootRelPath}index.html` },
    { label: 'Persone', href: `${rootRelPath}surnames/index.html` },
    ...(person.surname && !isLiving
      ? [{ label: person.surname, href: `${rootRelPath}surnames/index.html#${surnameAnchorId(person.surname)}` }]
      : []),
    { label: displayName },
  ]);

  const content = `
  ${breadcrumb}

  <header class="intestazione">
    <div>
      <h1 class="page-title">${escapeHtml(displayName)}${isLiving ? '<span class="timbro grande">Riservato</span>' : ''}</h1>
      ${person.maiden_name && !isLiving ? `<p class="sottotitolo">nata ${escapeHtml(person.maiden_name)}</p>` : ''}
      ${person.alternative_names?.length && !isLiving ? `<p class="sottotitolo">detto anche ${person.alternative_names.map((n) => escapeHtml(n)).join(', ')}</p>` : ''}
      ${estremi ? `<p class="estremi">${estremi}</p>` : ''}
      ${occupations ? `<p class="occupazioni">${escapeHtml(occupations)}</p>` : ''}
      <div class="intestazione-azioni">
        <a href="${rootRelPath}trees/${person.id}.html" class="btn btn-primary">Apri l'albero</a>
      </div>
    </div>
    ${personSegnatura(person, dataset)}
  </header>

  ${!isLiving && person.biography ? `
  <section class="sezione">
    <h2>Biografia</h2>
    <div class="biografia"><p>${escapeHtml(person.biography)}</p></div>
  </section>` : ''}

  <section class="sezione" aria-labelledby="legami-titolo">
    <h2 id="legami-titolo">Legami</h2>
    <dl class="legami">
      <dt>Genitori</dt>
      <dd>${parentsHtml}</dd>
      ${siblingsHtml}
      ${unioniHtml}
    </dl>
  </section>

  <section class="sezione" aria-labelledby="registro-titolo">
    <h2 id="registro-titolo">Registro</h2>
    ${registroHtml}
  </section>

  ${allegatiHtml}

  ${notes.length || nextStep ? `
  <section class="sezione" aria-labelledby="note-titolo">
    <h2 id="note-titolo">Note di ricerca</h2>
    ${notes.length ? `<ul>${notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}
    ${nextStep ? `<div class="next-step-box"><div class="next-step-title">Per trovare i genitori</div>${nextStep.split(/\n+/).filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('')}</div>` : ''}
  </section>` : ''}
  `;

  const jsonLd = !isLiving
    ? {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: displayName,
        givenName: person.given_names,
        familyName: person.surname,
        ...(person.sex === 'male' || person.sex === 'female' ? { gender: person.sex } : {}),
        ...(birth?.date?.year ? { birthDate: formatDate(birth.date) } : {}),
        ...(death?.date?.year ? { deathDate: formatDate(death.date) } : {}),
        ...(birth?.place_id ? { birthPlace: { '@type': 'Place', name: placeName(birth.place_id) } } : {}),
        ...(death?.place_id ? { deathPlace: { '@type': 'Place', name: placeName(death.place_id) } } : {}),
      }
    : undefined;

  return renderLayout({
    title: displayName,
    description: `Fascicolo di ${displayName}`,
    rootRelPath,
    activeNav: 'surnames',
    serie,
    jsonLd,
    content,
  });
}
