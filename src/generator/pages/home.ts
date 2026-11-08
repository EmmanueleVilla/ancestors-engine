import { renderLayout } from '../components/layout.js';
import { escapeHtml } from '../components/base.js';
import { NormalizedDataset } from '../../validator/index.js';
import { allSeries, serieHeads, serieOf } from '../components/serie.js';
import { nameOf } from '../components/fascicolo.js';
import { getSiteSettings, getRootPersonId } from '../site.js';

function birthYear(id: string, dataset: NormalizedDataset): number | undefined {
  const p = dataset.people.get(id);
  if (!p || p.privacy === 'living-person restricted' || !p.birth_event_id) return undefined;
  return dataset.events.get(p.birth_event_id)?.date?.year;
}

export function renderHomePage(dataset: NormalizedDataset, rootRelPath: string = './'): string {
  const peopleCount = dataset.people.size;
  const familiesCount = dataset.families.size;
  const placesCount = dataset.places.size;
  const sourcesCount = dataset.sources.size;
  const mediaCount = dataset.media.size;

  const years = [...dataset.events.values()]
    .map((e) => e.date?.year)
    .filter((y): y is number => typeof y === 'number' && y > 1000);
  const minYear = years.length ? Math.min(...years) : undefined;
  const maxYear = years.length ? Math.max(...years) : undefined;

  const site = getSiteSettings();
  const rootId = getRootPersonId(dataset);
  const root = (rootId && dataset.people.get(rootId)) || Array.from(dataset.people.values())[0];

  // Lo scaffale: un faldone per serie
  const series = allSeries(dataset);
  const members = new Map<number, string[]>();
  for (const id of dataset.people.keys()) {
    const s = serieOf(id, dataset);
    if (s.index > 0) members.set(s.index, [...(members.get(s.index) || []), id]);
  }

  const dorso = (s: (typeof series)[number]): string => {
    const ids = members.get(s.index) || [];
    const ys = ids.map((id) => birthYear(id, dataset)).filter((y): y is number => !!y);
    const span = !ys.length ? '' : Math.min(...ys) === Math.max(...ys) ? `${ys[0]}` : `${Math.min(...ys)}–${Math.max(...ys)}`;
    const heads = serieHeads(s, dataset);
    const coppia = heads.map((id) => escapeHtml(nameOf(dataset.people.get(id), id))).join(' e ');
    const target = heads[0] ? `${rootRelPath}trees/${heads[0]}.html` : '#';
    return `
      <a class="dorso ${s.cls}" href="${target}" aria-label="Serie ${s.roman}, ${escapeHtml(s.name)}: apri l'albero di ${coppia}">
        <span class="dorso-etichetta"><span class="serie-num">${s.roman}</span>${ids.length} fasc.</span>
        <span class="dorso-foro" aria-hidden="true"></span>
        <span class="dorso-cognome">${escapeHtml(s.name)}</span>
        <span class="dorso-piede"><span class="coppia">${coppia}</span>${span ? `<span class="anni-serie"><span class="nati">nati </span>${span}</span>` : ''}</span>
      </a>`;
  };

  // Uno scaffale per ramo: le serie della radice e quelle del coniuge
  const NUMERI = ['', 'Una serie', 'Due serie', 'Tre serie', 'Quattro serie', 'Cinque serie', 'Sei serie', 'Sette serie', 'Otto serie'];
  const rami = [...new Set(series.map((s) => s.ramoId))].map((ramoId) => {
    const ss = series.filter((s) => s.ramoId === ramoId);
    const chi = escapeHtml(nameOf(dataset.people.get(ramoId), ramoId));
    const titolo = `${NUMERI[ss.length] || `${ss.length} serie`} · ramo di ${chi}`;
    return { n: ss.length, html: `
      <div class="ramo" style="--cols: ${ss.length}">
        <h2 class="etichetta">${titolo}</h2>
        <div class="scaffale">${ss.map(dorso).join('')}</div>
      </div>` };
  });

  const scaffale = rami.length
    ? `
    <section class="fondo-serie" aria-label="Le serie dell'archivio">
      <div class="scaffali${rami.length === 1 ? ' scaffali-uno' : ''}" style="--n1: ${rami[0].n}fr; --n2: ${rami[1]?.n ?? 0}fr">${rami.map((r) => r.html).join('')}</div>
    </section>`
    : '';

  const content = `
  <header class="fondo-testa">
    <div class="fondo-scheda">
      <h1 class="titolo">${escapeHtml(site.homeTitle)}</h1>
      <dl class="consistenza" aria-label="Consistenza del fondo">
        <dt>Estremi</dt><dd>${minYear ?? '?'}–${maxYear ?? '?'}</dd>
        <dt>Persone</dt><dd>${peopleCount} fascicoli, ${familiesCount} famiglie</dd>
        <dt>Documenti</dt><dd>${mediaCount} allegati da ${sourcesCount} fonti</dd>
        <dt>Luoghi</dt><dd>${placesCount}</dd>
      </dl>
    </div>
    <div class="fondo-intro">
      <p class="sottotitolo">${escapeHtml(site.homeIntro)}</p>
      <p class="scaffale-nota">Le serie dell'autore e quelle del coniuge partono dalle quattro linee dei nonni e bisnonni; ognuna raccoglie gli antenati e i figli della linea. Chi è stato trovato negli atti ma non è ancora collegato resta nel fondo generale.</p>
      ${root ? `<a class="btn btn-primary apri-primo" href="${rootRelPath}trees/${root.id}.html">Apri l'albero di ${escapeHtml(nameOf(root))}</a>` : ''}
    </div>
    ${scaffale}
  </header>

  <section class="sezione" aria-labelledby="inventario-titolo">
    <h2 id="inventario-titolo">Inventario</h2>
    <ul class="inventario">
      <li><a href="${rootRelPath}surnames/index.html"><span class="voce">Persone</span><span class="guida"></span><span class="quanti">${peopleCount}</span><span class="spiega">Tutti i fascicoli, in ordine di cognome.</span></a></li>
      <li><a href="${rootRelPath}places/index.html"><span class="voce">Luoghi</span><span class="guida"></span><span class="quanti">${placesCount}</span><span class="spiega">Paesi, frazioni e parrocchie dove si nasce, ci si sposa e si muore.</span></a></li>
      <li><a href="${rootRelPath}sources/index.html"><span class="voce">Fonti</span><span class="guida"></span><span class="quanti">${sourcesCount}</span><span class="spiega">Registri di stato civile, ruoli matricolari, lapidi: da dove viene ogni dato.</span></a></li>
      <li><a href="${rootRelPath}timeline.html"><span class="voce">Cronologia</span><span class="guida"></span><span class="quanti">${dataset.events.size}</span><span class="spiega">Nascite, matrimoni e morti in ordine di tempo.</span></a></li>
      <li><a href="${rootRelPath}search.html"><span class="voce">Cerca</span><span class="guida"></span><span class="quanti">nome, anno, luogo</span><span class="spiega">Ricerca immediata nei fascicoli.</span></a></li>
    </ul>
  </section>
  `;

  return renderLayout({
    title: 'Archivio',
    description: site.description,
    rootRelPath,
    activeNav: 'home',
    content,
  });
}
