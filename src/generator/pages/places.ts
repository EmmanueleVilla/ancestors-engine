import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { NormalizedDataset } from '../../validator/index.js';

const PLACE_TYPES: Record<string, string> = {
  country: 'stato', region: 'regione', province: 'provincia', county: 'provincia',
  city: 'città', town: 'comune', municipality: 'comune', village: 'paese', hamlet: 'frazione',
  parish: 'parrocchia', church: 'chiesa', cemetery: 'cimitero', address: 'indirizzo', other: 'altro',
};
export function placeTypeLabel(t?: string): string {
  return t ? PLACE_TYPES[t] ?? t : '';
}

export function renderPlacesDirectoryPage(dataset: NormalizedDataset, rootRelPath: string = '../'): string {
  const places = [...dataset.places.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'));
  const childrenMap = new Map<string, string[]>();
  const rootPlaces: string[] = [];
  for (const p of places) {
    if (p.parent_place_id && dataset.places.has(p.parent_place_id)) {
      childrenMap.set(p.parent_place_id, [...(childrenMap.get(p.parent_place_id) || []), p.id]);
    } else {
      rootPlaces.push(p.id);
    }
  }

  const eventCount = new Map<string, number>();
  for (const e of dataset.events.values()) if (e.place_id) eventCount.set(e.place_id, (eventCount.get(e.place_id) || 0) + 1);

  function renderHierarchy(placeId: string): string {
    const p = dataset.places.get(placeId);
    if (!p) return '';
    const children = childrenMap.get(placeId) || [];
    const n = eventCount.get(p.id);
    return `
    <li>
      <a href="${rootRelPath}places/${p.id}.html">${escapeHtml(p.name)}</a>
      ${p.place_type ? ` <span class="badge">${escapeHtml(placeTypeLabel(p.place_type))}</span>` : ''}
      ${n ? ` <span class="dattilo muto">${n} ${n === 1 ? 'evento' : 'eventi'}</span>` : ''}
      ${children.length ? `<ul>${children.map(renderHierarchy).join('')}</ul>` : ''}
    </li>`;
  }

  const content = `
  <header>
    <h1 class="sr-only">Luoghi</h1>
    <p class="sottotitolo">Paesi, frazioni e parrocchie in cui la famiglia nasce, si sposa e muore.</p>
  </header>
  <section class="sezione">
    ${rootPlaces.length ? `<ul class="luoghi-albero">${rootPlaces.map(renderHierarchy).join('')}</ul>` : '<p class="muto">Nessun luogo registrato.</p>'}
  </section>
  `;

  return renderLayout({
    title: 'Luoghi',
    description: 'Luoghi della famiglia: paesi, frazioni, parrocchie',
    rootRelPath,
    activeNav: 'places',
    content,
  });
}
