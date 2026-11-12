import { Family, getChildConfidence } from '../../model/family.js';
import { escapeHtml } from './base.js';
import { Person, getPersonDisplayName } from '../../model/person.js';
import { NormalizedDataset } from '../../validator/index.js';
import { formatResearchYears, type ResearchEntry } from '../../model/research.js';
import { isPdfMedia } from '../../model/media.js';
import { serieOf } from './serie.js';
import { getRootPersonId } from '../site.js';
import { buildParentsOf, directAncestorsOf, missingParents } from '../../validator/lineage.js';

export function renderTreeNode(personId: string, dataset: NormalizedDataset, rootRelPath: string = '../'): string {
  const person = dataset.people.get(personId);
  if (!person) {
    return `<div class="tree-node unknown"><span>Sconosciuto</span></div>`;
  }

  const isLiving = person.privacy === 'living-person restricted';
  const name = isLiving ? '[Living]' : getPersonDisplayName(person);
  const birthEvt = person.birth_event_id ? dataset.events.get(person.birth_event_id) : undefined;
  const deathEvt = person.death_event_id ? dataset.events.get(person.death_event_id) : undefined;

  const bYear = !isLiving && birthEvt?.date?.year ? String(birthEvt.date.year) : '';
  const dYear = !isLiving && deathEvt?.date?.year ? String(deathEvt.date.year) : '';
  const years = bYear || dYear ? `(${bYear}–${dYear})` : '';

  return `
  <div class="tree-node ${isLiving ? 'living' : ''}">
    <a href="${rootRelPath}people/${person.id}.html"><strong>${escapeHtml(name)}</strong></a>
    ${years ? `<div class="anni">${escapeHtml(years)}</div>` : ''}
  </div>
  `;
}

export function buildAncestorBranch(
  personId: string,
  dataset: NormalizedDataset,
  depth: number,
  maxDepth: number = 4,
  rootRelPath: string = '../'
): string {
  if (depth > maxDepth) return '';

  const parentRels = dataset.relationships.filter(
    (r) => r.related_person_id === personId && r.relationship_type.endsWith('_parent')
  );

  const nodeHtml = renderTreeNode(personId, dataset, rootRelPath);

  if (parentRels.length === 0 || depth === maxDepth) {
    return `<div class="tree-branch">${nodeHtml}</div>`;
  }

  const parentsHtml = parentRels
    .map((r) => buildAncestorBranch(r.person_id, dataset, depth + 1, maxDepth, rootRelPath))
    .join('');

  return `
  <div class="tree-branch" style="display: flex; align-items: center;">
    ${nodeHtml}
    <div class="rami">
      ${parentsHtml}
    </div>
  </div>
  `;
}

export function buildDescendantBranch(
  personId: string,
  dataset: NormalizedDataset,
  depth: number,
  maxDepth: number = 3,
  rootRelPath: string = '../'
): string {
  if (depth > maxDepth) return '';

  // Children are those where person_id is parent
  const childRels = dataset.relationships.filter(
    (r) => r.person_id === personId && r.relationship_type.endsWith('_parent')
  );

  const nodeHtml = renderTreeNode(personId, dataset, rootRelPath);

  if (childRels.length === 0 || depth === maxDepth) {
    return `<div class="tree-branch">${nodeHtml}</div>`;
  }

  const childrenHtml = childRels
    .map((r) => buildDescendantBranch(r.related_person_id, dataset, depth + 1, maxDepth, rootRelPath))
    .join('');

  return `
  <div class="tree-branch" style="display: flex; align-items: center;">
    ${nodeHtml}
    <div class="rami">
      ${childrenHtml}
    </div>
  </div>
  `;
}

export type FoundInKind = 'nascita' | 'matrimonio' | 'morte' | 'guerra';

export interface TreeCanvasNode {
  id: string;
  name: string;
  sex?: 'male' | 'female' | 'unknown' | 'unspecified';
  birthDate?: string;
  birthYear?: number;
  birthPlace?: string;
  deathDate?: string;
  deathYear?: number;
  dateText?: string;
  isPlaceholder?: boolean;
  /** Segnaposto "?" per i genitori ancora da trovare di un antenato diretto. */
  unknownParents?: {
    childId: string;
    childName: string;
    missing: 'both' | 'father' | 'mother';
    knownParentId?: string;
    nextStep?: string;
    research?: TreeCanvasResearch[];
  };
  isLiving: boolean;
  isFocus: boolean;
  /** Linea principale: la radice configurata, i suoi antenati diretti e i suoi discendenti. */
  isDirectLine?: boolean;
  /** Serie dell'archivio (1-4, 0 = fondo generale): colore della fascia in testa alla scheda. */
  serie?: number;
  /** Tipi di documento in cui compare il nome: icone in basso a destra nella scheda. */
  foundIn?: FoundInKind[];
  generation: number;
  role: string;
  url: string;
  treeUrl: string;
}

export interface TreeCanvasEdge {
  from: string;
  to: string;
  type: 'parent-child' | 'spouse';
  familyId?: string;
  /** Freccia dal segnaposto "?" dei genitori da trovare. */
  unknownParent?: boolean;
  /** Per i legami genitore-figlio non certi (probable, possible, ...). */
  confidence?: string;
  /** Legame genitore-figlio: nomi e documenti che lo provano. */
  parentName?: string;
  childName?: string;
  evidence?: TreeCanvasEvidence[];
  spouse1Name?: string;
  spouse2Name?: string;
  marriageDate?: string;
  marriagePlace?: string;
  sourceId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  sourceCallNumber?: string;
  sourcePage?: string;
  sourcePageUrl?: string;
  media?: TreeCanvasMedia[];
  notes?: string[];
  research?: TreeCanvasResearch[];
}

export interface TreeCanvasMedia {
  url: string;
  title?: string;
  isPdf: boolean;
}

export interface TreeCanvasEvidence {
  sourceTitle: string;
  sourceUrl?: string;
  sourcePageUrl?: string;
  callNumber?: string;
  page?: string;
  quote?: string;
  notes?: string[];
}

export interface TreeCanvasResearch {
  date: string;
  goal: string;
  source?: string;
  place?: string;
  register?: string;
  years?: string;
  outcome: string;
  note?: string;
  media?: TreeCanvasMedia[];
  /** Paradati: chi, come, con quali grafie e strumenti, lacune della fonte. */
  actor?: string;
  method?: string;
  terms?: string[];
  tools?: string[];
  coverage?: string;
}

export interface TreeCanvasGraph {
  focusId: string;
  nodes: TreeCanvasNode[];
  edges: TreeCanvasEdge[];
}

/** Media linked to a research entry; ids missing from the (privacy-filtered) dataset are skipped. */
function researchMedia(
  ids: string[] | undefined,
  dataset: NormalizedDataset,
  rootRelPath: string
): TreeCanvasMedia[] | undefined {
  const media = (ids || [])
    .map((id) => dataset.media.get(id))
    .filter((med): med is NonNullable<typeof med> => !!med)
    .map((med) => ({
      url: `${rootRelPath}media/${med.file_path.split('/').pop()}`,
      title: med.title,
      isPdf: isPdfMedia(med.file_path, med.mime_type),
    }));
  return media.length > 0 ? media : undefined;
}

/** Una voce del registro ricerche nel formato dei popup dell'albero. */
function toCanvasResearch(r: ResearchEntry, dataset: NormalizedDataset, rootRelPath: string): TreeCanvasResearch {
  return {
    date: r.date,
    goal: r.goal,
    source: r.source || undefined,
    place: r.place || undefined,
    register: r.register || undefined,
    years: formatResearchYears(r.years) || undefined,
    outcome: r.outcome,
    note: r.notes || undefined,
    media: researchMedia(r.media, dataset, rootRelPath),
    actor: r.performed_by,
    method: r.method,
    terms: r.search_terms?.length ? r.search_terms : undefined,
    tools: r.tools?.length ? r.tools : undefined,
    coverage: r.coverage || undefined,
  };
}

function collectFamilyResearch(
  familyId: string,
  startEventId: string | undefined,
  dataset: NormalizedDataset,
  rootRelPath: string
): TreeCanvasResearch[] | undefined {
  const entries = (dataset.research || [])
    .filter((r) => r.references.includes(familyId) || (!!startEventId && r.references.includes(startEventId)))
    .map((r) => toCanvasResearch(r, dataset, rootRelPath));
  return entries.length > 0 ? entries : undefined;
}

function displayNameFor(p: Person | undefined, fallback: string): string {
  if (!p) return fallback;
  return p.privacy === 'living-person restricted' ? '[Living]' : getPersonDisplayName(p);
}

/**
 * Documenti che provano che childId è figlio della coppia della famiglia:
 * citazioni del figlio legate alla famiglia, citazioni del figlio sulla parentela (es. atto di matrimonio
 * che nomina i genitori) e quelle elencate a mano in child_citation_ids. Con i media di quelle citazioni.
 */
function collectChildEvidence(
  fam: Family,
  childId: string,
  dataset: NormalizedDataset,
  rootRelPath: string
): { evidence?: TreeCanvasEvidence[]; media?: TreeCanvasMedia[] } {
  const explicit = new Set(fam.child_citation_ids?.[childId] || []);
  const child = dataset.people.get(childId);
  const childCitIds = new Set(child?.source_citation_ids || []);
  const famCitIds = new Set(fam.source_citation_ids || []);
  const cits = [...dataset.citations.values()].filter(
    (c) =>
      explicit.has(c.id) ||
      ((c.person_id === childId || childCitIds.has(c.id)) &&
        (c.family_id === fam.id || famCitIds.has(c.id) || /parentage/.test(c.claim_type)))
  );
  const evidence: TreeCanvasEvidence[] = [];
  const media: TreeCanvasMedia[] = [];
  const seenMedia = new Set<string>();
  for (const c of cits) {
    const src = dataset.sources.get(c.source_id);
    evidence.push({
      sourceTitle: src?.title || c.source_id,
      sourceUrl: src?.url,
      sourcePageUrl: src ? `${rootRelPath}sources/${src.id}.html` : undefined,
      callNumber: src?.call_number,
      page: c.page_or_folio,
      quote: c.quoted_text,
      notes: c.notes && c.notes.length > 0 ? c.notes : undefined,
    });
    const evt = c.event_id ? dataset.events.get(c.event_id) : undefined;
    for (const med of dataset.media.values()) {
      const byEvent = !!c.event_id && ((med.event_ids || []).includes(c.event_id) || (evt?.media_ids || []).includes(med.id));
      const bySource = med.source_id === c.source_id && (med.person_ids || []).includes(childId);
      if ((byEvent || bySource) && !seenMedia.has(med.id)) {
        seenMedia.add(med.id);
        media.push({
          url: `${rootRelPath}media/${med.file_path.split('/').pop()}`,
          title: med.title,
          isPdf: isPdfMedia(med.file_path, med.mime_type),
        });
      }
    }
  }
  return {
    evidence: evidence.length > 0 ? evidence : undefined,
    media: media.length > 0 ? media : undefined,
  };
}

export function extractTreeGraphData(
  personId: string,
  dataset: NormalizedDataset,
  rootRelPath: string = '../'
): TreeCanvasGraph {
  const nodesMap = new Map<string, TreeCanvasNode>();
  const edges: TreeCanvasEdge[] = [];
  const edgeKeys = new Set<string>();

  function addEdge(from: string, to: string, type: 'parent-child' | 'spouse', extra?: Partial<TreeCanvasEdge>) {
    const key = `${from}->${to}:${type}`;
    const reverseKey = type === 'spouse' ? `${to}->${from}:${type}` : '';
    if (!edgeKeys.has(key) && (!reverseKey || !edgeKeys.has(reverseKey))) {
      edgeKeys.add(key);
      edges.push({ from, to, type, ...extra });
    }
  }

  // 1. All spouse & parent-child edges from families
  for (const fam of dataset.families.values()) {
    if (fam.partner_ids && fam.partner_ids.length >= 2) {
      for (let i = 0; i < fam.partner_ids.length; i++) {
        for (let j = i + 1; j < fam.partner_ids.length; j++) {
          const p1 = dataset.people.get(fam.partner_ids[i]);
          const p2 = dataset.people.get(fam.partner_ids[j]);
          const spouse1Name = p1 ? getPersonDisplayName(p1) : '';
          const spouse2Name = p2 ? getPersonDisplayName(p2) : '';

          let marriageDate: string | undefined;
          let marriagePlace: string | undefined;
          let sourceId: string | undefined;
          let sourceTitle: string | undefined;
          let sourceUrl: string | undefined;
          let sourceCallNumber: string | undefined;
          let sourcePage: string | undefined;
          let sourcePageUrl: string | undefined;
          const media: TreeCanvasMedia[] = [];
          const notes: string[] = [...(fam.notes || [])];
          if (fam.unrecorded_children) {
            const n = fam.unrecorded_children.count;
            notes.push(
              `Altri ${n} figli noti ma non inseriti nell'albero` +
                (fam.unrecorded_children.note ? `: ${fam.unrecorded_children.note}` : '.')
            );
          }

          if (fam.start_event_id) {
            const startEvt = dataset.events.get(fam.start_event_id);
            if (startEvt) {
              if (startEvt.date) {
                if (startEvt.date.day && startEvt.date.month && startEvt.date.year) {
                  marriageDate = `${startEvt.date.day}/${startEvt.date.month}/${startEvt.date.year}`;
                } else if (startEvt.date.year) {
                  marriageDate = String(startEvt.date.year);
                }
              }
              if (startEvt.place_id) {
                const plc = dataset.places.get(startEvt.place_id);
                if (plc) marriagePlace = plc.name;
              }
              if (startEvt.notes) {
                notes.push(...startEvt.notes);
              }

              // Look for citation matching startEvt.id or fam.id
              for (const cit of dataset.citations.values()) {
                if (cit.event_id === startEvt.id || cit.family_id === fam.id) {
                  const src = dataset.sources.get(cit.source_id);
                  if (src) {
                    sourceId = src.id;
                    sourceTitle = src.title;
                    sourceUrl = src.url;
                    sourceCallNumber = src.call_number;
                    sourcePage = cit.page_or_folio;
                    sourcePageUrl = `${rootRelPath}sources/${src.id}.html`;
                  }
                  break;
                }
              }

              // All media linked to the marriage event; if none, fall back to media of the
              // citing source that mention one of the spouses (or the first one of that source).
              const toTreeMedia = (med: { file_path: string; title?: string; mime_type?: string }): TreeCanvasMedia => ({
                url: `${rootRelPath}media/${med.file_path.split('/').pop()}`,
                title: med.title,
                isPdf: isPdfMedia(med.file_path, med.mime_type),
              });
              const allMedia = [...dataset.media.values()];
              const evtMediaIds = new Set(startEvt.media_ids || []);
              for (const med of allMedia) {
                if (evtMediaIds.has(med.id) || (med.event_ids && med.event_ids.includes(startEvt.id))) {
                  media.push(toTreeMedia(med));
                }
              }
              if (media.length === 0 && sourceId) {
                const fromSource = allMedia.filter((med) => med.source_id === sourceId);
                const partners = new Set(fam.partner_ids);
                const aboutSpouses = fromSource.filter((med) => (med.person_ids || []).some((pid) => partners.has(pid)));
                const chosen = aboutSpouses.length > 0 ? aboutSpouses : fromSource.slice(0, 1);
                media.push(...chosen.map(toTreeMedia));
              }
            }
          }

          addEdge(fam.partner_ids[i], fam.partner_ids[j], 'spouse', {
            familyId: fam.id,
            spouse1Name,
            spouse2Name,
            marriageDate,
            marriagePlace,
            sourceId,
            sourceTitle,
            sourceUrl,
            sourceCallNumber,
            sourcePage,
            sourcePageUrl,
            media: media.length > 0 ? media : undefined,
            notes: notes.length > 0 ? notes : undefined,
            research: collectFamilyResearch(fam.id, fam.start_event_id, dataset, rootRelPath),
          });
        }
      }
    }

    if (fam.partner_ids && fam.children_ids) {
      for (const childId of fam.children_ids) {
        const child = dataset.people.get(childId);
        const { evidence, media } = collectChildEvidence(fam, childId, dataset, rootRelPath);
        for (const parentId of fam.partner_ids) {
          const parent = dataset.people.get(parentId);
          const confidence = getChildConfidence(fam, parentId, childId);
          addEdge(parentId, childId, 'parent-child', {
            familyId: fam.id,
            parentName: displayNameFor(parent, parentId),
            childName: displayNameFor(child, childId),
            evidence,
            media,
            ...(confidence
              ? {
                  confidence,
                  notes: fam.notes && fam.notes.length > 0 ? [...fam.notes] : undefined,
                  research: collectFamilyResearch(fam.id, fam.start_event_id, dataset, rootRelPath),
                }
              : {}),
          });
        }
      }
    }
  }

  // Relationships
  for (const rel of dataset.relationships) {
    if (rel.relationship_type.endsWith('_parent')) {
      addEdge(rel.person_id, rel.related_person_id, 'parent-child');
    } else if (rel.relationship_type === 'spouse' || rel.relationship_type === 'partner') {
      addEdge(rel.person_id, rel.related_person_id, 'spouse');
    }
  }

  // 2. Build adjacency graph to compute generations via BFS
  const adj = new Map<string, { to: string; dGen: number }[]>();
  for (const pid of dataset.people.keys()) {
    adj.set(pid, []);
  }

  for (const e of edges) {
    if (e.type === 'spouse') {
      adj.get(e.from)?.push({ to: e.to, dGen: 0 });
      adj.get(e.to)?.push({ to: e.from, dGen: 0 });
    } else if (e.type === 'parent-child') {
      adj.get(e.from)?.push({ to: e.to, dGen: 1 });
      adj.get(e.to)?.push({ to: e.from, dGen: -1 });
    }
  }

  // Only people connected (through any chain of kinship) to the focus person belong in this tree.
  // Unconnected clusters (e.g. people tagged 'scollegato') get their own tree page instead.
  const component = new Set<string>();
  const startId = dataset.people.has(personId) ? personId : Array.from(dataset.people.keys())[0];
  if (startId) {
    component.add(startId);
    const stack = [startId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const edge of adj.get(cur) || []) {
        if (!component.has(edge.to)) {
          component.add(edge.to);
          stack.push(edge.to);
        }
      }
    }
  }

  // Root for generation calculation: the configured root person when it is in this tree, otherwise the focus person
  const siteRoot = getRootPersonId(dataset);
  const rootId = siteRoot && component.has(siteRoot) ? siteRoot : startId;
  const genMap = new Map<string, number>();
  if (rootId) {
    genMap.set(rootId, 0);
    const queue = [rootId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curGen = genMap.get(cur)!;
      for (const edge of adj.get(cur) || []) {
        if (!genMap.has(edge.to)) {
          genMap.set(edge.to, curGen + edge.dGen);
          queue.push(edge.to);
        }
      }
    }
  }

  // Set default gen 0 for any disconnected node
  for (const pid of dataset.people.keys()) {
    if (!genMap.has(pid)) genMap.set(pid, 0);
  }

  // Identify direct roles relative to personId
  const parentIds = new Set(
    dataset.relationships
      .filter((r) => r.related_person_id === personId && r.relationship_type.endsWith('_parent'))
      .map((r) => r.person_id)
  );
  const childIds = new Set(
    dataset.relationships
      .filter((r) => r.person_id === personId && r.relationship_type.endsWith('_parent'))
      .map((r) => r.related_person_id)
  );
  const spouseIds = new Set(
    dataset.relationships
      .filter((r) => (r.person_id === personId || r.related_person_id === personId) && (r.relationship_type === 'spouse' || r.relationship_type === 'partner'))
      .map((r) => (r.person_id === personId ? r.related_person_id : r.person_id))
  );

  // Include every person connected to the focus person
  for (const p of dataset.people.values()) {
    if (!component.has(p.id)) continue;
    const isLiving = p.privacy === 'living-person restricted';
    let name = isLiving ? '[Living]' : getPersonDisplayName(p);
    if (!name || name === '? ?') {
      name = 'Nome TBD';
    }

    const birthEvt = p.birth_event_id ? dataset.events.get(p.birth_event_id) : undefined;
    const deathEvt = p.death_event_id ? dataset.events.get(p.death_event_id) : undefined;

    let birthPlace: string | undefined;
    if (!isLiving && birthEvt?.place_id) {
      const place = dataset.places.get(birthEvt.place_id);
      if (place) birthPlace = place.name;
    }

    let birthDate: string | undefined;
    let birthYear: number | undefined;
    if (!isLiving && birthEvt?.date) {
      birthYear = birthEvt.date.year;
      if (birthEvt.date.day && birthEvt.date.month && birthEvt.date.year) {
        birthDate = `${birthEvt.date.day}/${birthEvt.date.month}/${birthEvt.date.year}`;
      } else if (birthEvt.date.year) {
        birthDate = String(birthEvt.date.year);
      }
    }

    let deathDate: string | undefined;
    let deathYear: number | undefined;
    if (!isLiving && deathEvt?.date && (deathEvt.date.precision === 'before' || deathEvt.date.precision === 'after')) {
      deathYear = deathEvt.date.year;
      deathDate = `${deathEvt.date.precision === 'before' ? 'ante' : 'post'} ${deathEvt.date.year}`;
    } else if (!isLiving && deathEvt?.date) {
      deathYear = deathEvt.date.year;
      if (deathEvt.date.day && deathEvt.date.month && deathEvt.date.year) {
        deathDate = `${deathEvt.date.day}/${deathEvt.date.month}/${deathEvt.date.year}`;
      } else if (deathEvt.date.year) {
        deathDate = String(deathEvt.date.year);
      }
    }

    let dateText: string | undefined;
    if (!birthDate && !deathDate) {
      const hasTbdNote = p.notes && p.notes.some((n) => /tbd/i.test(n));
      if (hasTbdNote) {
        dateText = 'TBD';
      }
    }

    let role = 'relative';
    if (p.id === personId) {
      role = 'focus';
    } else if (spouseIds.has(p.id)) {
      role = 'spouse';
    } else if (parentIds.has(p.id)) {
      role = 'parent';
    } else if (childIds.has(p.id)) {
      role = 'child';
    }

    const foundIn = isLiving ? undefined : foundInKinds(p.id, dataset);

    const node: TreeCanvasNode = {
      foundIn,
      serie: Math.min(serieOf(p.id, dataset).index, 8),
      id: p.id,
      name,
      sex: p.sex,
      birthDate,
      birthYear,
      birthPlace,
      deathDate,
      deathYear,
      dateText,
      isLiving,
      isFocus: p.id === personId,
      generation: genMap.get(p.id) ?? 0,
      role,
      url: `${rootRelPath}people/${p.id}.html`,
      treeUrl: `${rootRelPath}trees/${p.id}.html`,
    };

    nodesMap.set(p.id, node);
  }

  // Figli noti ma non ricercati: un'unica scheda segnaposto sotto i genitori.
  for (const fam of dataset.families.values()) {
    const extra = fam.unrecorded_children;
    if (!extra) continue;
    const parents = (fam.partner_ids || []).filter((pid) => nodesMap.has(pid));
    if (parents.length === 0) continue;
    const id = `${fam.id}__altri_figli`;
    const n = extra.count;
    const hasRecorded = (fam.children_ids || []).length > 0;
    const label = hasRecorded
      ? `+${n} ${n === 1 ? 'fratello/sorella' : 'fratelli/sorelle'}`
      : `${n} ${n === 1 ? 'figlio/a' : 'figli/e'}`;
    nodesMap.set(id, {
      id,
      name: label,
      sex: 'unknown',
      dateText: extra.label,
      isLiving: false,
      isFocus: false,
      isPlaceholder: true,
      generation: Math.max(...parents.map((pid) => nodesMap.get(pid)!.generation)) + 1,
      role: 'placeholder',
      url: '',
      treeUrl: '',
    });
    component.add(id);
    for (const pid of parents) addEdge(pid, id, 'parent-child');
  }

  addUnknownParentPlaceholders(dataset, nodesMap, component, rootId, addEdge, rootRelPath);
  for (const id of directLineOf(rootId, edges, getRootPersonId(dataset))) {
    const n = nodesMap.get(id);
    if (n && !n.isPlaceholder) n.isDirectLine = true;
  }

  return {
    focusId: personId,
    nodes: Array.from(nodesMap.values()),
    edges: edges.filter((e) => component.has(e.from) && component.has(e.to)),
  };
}

/**
 * Segnaposto "?" sopra gli antenati diretti della radice configurata e del coniuge con cui ha figli,
 * che non hanno ancora padre e/o madre: i prossimi passi visibili a colpo d'occhio.
 * Solo linea diretta, per non allargarsi ai collaterali.
 */
function addUnknownParentPlaceholders(
  dataset: NormalizedDataset,
  nodesMap: Map<string, TreeCanvasNode>,
  component: Set<string>,
  rootId: string | undefined,
  addEdge: (from: string, to: string, type: 'parent-child' | 'spouse', extra?: Partial<TreeCanvasEdge>) => void,
  rootRelPath: string
): void {
  if (!rootId || rootId !== getRootPersonId(dataset) || !nodesMap.has(rootId)) return;

  const parentsOf = buildParentsOf(dataset.families.values(), dataset.relationships);

  for (const id of directAncestorsOf(rootId, dataset.families.values(), parentsOf)) {
    const person = dataset.people.get(id);
    const node = nodesMap.get(id);
    if (!person || !node || person.privacy === 'living-person restricted') continue;
    const parents = [...(parentsOf.get(id) || [])].map((pid) => dataset.people.get(pid)).filter((p): p is Person => !!p);
    const missing = missingParents(parents.map((p) => p.sex));
    if (!missing) continue;
    const childName = getPersonDisplayName(person);
    const research = (dataset.research || [])
      .filter((r) => r.references.includes(id))
      .map((r) => toCanvasResearch(r, dataset, rootRelPath));
    const placeholderId = `${id}__genitori_ignoti`;
    nodesMap.set(placeholderId, {
      id: placeholderId,
      name: missing === 'both' ? '? Padre e madre' : missing === 'father' ? '? Padre' : '? Madre',
      sex: missing === 'father' ? 'male' : missing === 'mother' ? 'female' : 'unknown',
      dateText: `di ${childName}`,
      isLiving: false,
      isFocus: false,
      isPlaceholder: true,
      generation: node.generation - 1,
      role: 'unknown-parents',
      url: '',
      treeUrl: '',
      unknownParents: {
        childId: id,
        childName,
        missing,
        knownParentId: parents[0]?.id,
        nextStep: person.parents_next_step,
        research: research.length > 0 ? research : undefined,
      },
    });
    component.add(placeholderId);
    addEdge(placeholderId, id, 'parent-child', { unknownParent: true });
  }
}

/** Radice (solo l'albero della radice configurata) + antenati diretti + discendenti, seguendo le frecce genitore-figlio. */
function directLineOf(rootId: string | undefined, edges: TreeCanvasEdge[], configuredRoot?: string): Set<string> {
  const line = new Set<string>();
  if (!rootId || rootId !== configuredRoot) return line;
  line.add(rootId);
  const pc = edges.filter((e) => e.type === 'parent-child' && !e.unknownParent);
  const walk = (start: string, next: (id: string) => string[]) => {
    const stack = [start];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      for (const n of next(cur)) {
        if (!line.has(n)) {
          line.add(n);
          stack.push(n);
        }
      }
    }
  };
  walk(rootId, (id) => pc.filter((e) => e.to === id).map((e) => e.from));
  walk(rootId, (id) => pc.filter((e) => e.from === id).map((e) => e.to));
  // Il coniuge con cui la radice ha figli e i suoi antenati: linea diretta dei figli.
  const children = pc.filter((e) => e.from === rootId).map((e) => e.to);
  const coParents = new Set(pc.filter((e) => children.includes(e.to) && e.from !== rootId).map((e) => e.from));
  for (const cp of coParents) {
    line.add(cp);
    walk(cp, (id) => pc.filter((e) => e.to === id).map((e) => e.from));
  }
  return line;
}

const FOUND_IN_ORDER: FoundInKind[] = ['nascita', 'matrimonio', 'morte', 'guerra'];

/** Tipo di documento di una citazione: atto di nascita, di matrimonio, di morte (o lapide), foglio matricolare. */
function citationKind(claimType: string, sourceType: string | undefined): FoundInKind | undefined {
  if (sourceType === 'military_record') return 'guerra';
  if (sourceType === 'gravestone') return 'morte';
  if (sourceType !== 'civil_registry' && sourceType !== 'church_record' && sourceType !== 'parish_register') return undefined;
  if (/^marriage/.test(claimType)) return 'matrimonio';
  if (/^death/.test(claimType)) return 'morte';
  if (/^birth|^parentage/.test(claimType)) return 'nascita';
  return undefined;
}

/**
 * In quali tipi di documento compare il nome di ogni persona:
 * - citazioni sue (person_id o source_citation_ids);
 * - matrimoni delle famiglie di cui è coniuge;
 * - atti dei figli che nominano i genitori (claim "...parentage"): nascita, matrimonio, foglio matricolare.
 */
const foundInCache = new WeakMap<NormalizedDataset, Map<string, FoundInKind[]>>();

function foundInKinds(personId: string, dataset: NormalizedDataset): FoundInKind[] | undefined {
  let map = foundInCache.get(dataset);
  if (!map) {
    map = buildFoundInMap(dataset);
    foundInCache.set(dataset, map);
  }
  return map.get(personId);
}

function buildFoundInMap(dataset: NormalizedDataset): Map<string, FoundInKind[]> {
  const kinds = new Map<string, Set<FoundInKind>>();
  const add = (pid: string | undefined, k: FoundInKind) => {
    if (!pid) return;
    const set = kinds.get(pid) || new Set<FoundInKind>();
    set.add(k);
    kinds.set(pid, set);
  };
  const families = [...dataset.families.values()];
  const parentsOf = (childId: string) =>
    families.filter((f) => (f.children_ids || []).includes(childId)).flatMap((f) => f.partner_ids || []);

  for (const c of dataset.citations.values()) {
    const k = citationKind(c.claim_type, dataset.sources.get(c.source_id)?.source_type);
    if (!k) continue;
    const isMarriage = /^marriage/.test(c.claim_type);
    const fam = c.family_id ? dataset.families.get(c.family_id) : undefined;
    add(c.person_id, k);
    // Gli sposi di un atto di matrimonio
    if (isMarriage && fam) for (const pid of fam.partner_ids || []) add(pid, k);
    // I genitori nominati nell'atto
    if (/parentage/.test(c.claim_type)) {
      const subjects = isMarriage && fam ? fam.partner_ids || [] : c.person_id ? [c.person_id] : [];
      for (const subj of subjects) {
        const parents = !isMarriage && fam && (fam.children_ids || []).includes(subj) ? fam.partner_ids || [] : parentsOf(subj);
        for (const pid of parents) add(pid, k);
      }
    }
  }
  // Citazioni elencate a mano sulla persona o sul matrimonio della famiglia
  for (const person of dataset.people.values()) {
    for (const cid of person.source_citation_ids || []) {
      const c = dataset.citations.get(cid);
      const k = c && citationKind(c.claim_type, dataset.sources.get(c.source_id)?.source_type);
      if (k) add(person.id, k);
    }
  }
  for (const fam of families) {
    for (const cid of fam.source_citation_ids || []) {
      const c = dataset.citations.get(cid);
      if (!c || !/^marriage/.test(c.claim_type)) continue;
      const k = citationKind(c.claim_type, dataset.sources.get(c.source_id)?.source_type);
      if (k) for (const pid of fam.partner_ids || []) add(pid, k);
    }
  }
  const out = new Map<string, FoundInKind[]>();
  for (const [pid, set] of kinds) out.set(pid, FOUND_IN_ORDER.filter((k) => set.has(k)));
  return out;
}
