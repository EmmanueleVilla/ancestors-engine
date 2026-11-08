import { NormalizedDataset } from '../../validator/index.js';
import { getRootPersonId } from '../site.js';

/**
 * "Serie" dell'archivio: le quattro linee che partono dalle coppie di bisnonni della persona radice
 * (configurata in archivio.config.yml, tree.root_id), più le quattro linee del coniuge con cui ha figli, che partono dalle coppie dei
 * suoi bisnonni (o, finché i bisnonni non sono noti, dai singoli nonni).
 * Ogni persona appartiene alla serie della coppia di cui è antenata o discendente;
 * chi non è collegato prende la serie del proprio cognome, altrimenti resta "fondo" (neutro).
 */
export interface Serie {
  /** 1-based; 0 = fondo generale. */
  index: number;
  roman: string;
  name: string;
  /** Classe CSS: serie-1 … serie-8, serie-0. */
  cls: string;
  /** Ramo: 'radice' (le serie della radice) o 'coniuge' (quelle del coniuge). */
  ramo: 'radice' | 'coniuge';
  /** Chi apre il ramo (la radice o il coniuge). */
  ramoId: string;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const FONDO: Serie = { index: 0, roman: '', name: 'Fondo', cls: 'serie-0', ramo: 'radice', ramoId: '' };
const MAX_SERIE_CLS = 8;


interface SerieIndex {
  series: Serie[];
  byPerson: Map<string, Serie>;
  heads: Map<number, string[]>;
}

const cache = new WeakMap<NormalizedDataset, SerieIndex>();

function parentsOf(id: string, dataset: NormalizedDataset): string[] {
  const ids = dataset.relationships
    .filter((r) => r.related_person_id === id && r.relationship_type.endsWith('_parent'))
    .map((r) => r.person_id);
  // padre prima della madre
  return ids.sort((a, b) => {
    const sa = dataset.people.get(a)?.sex === 'male' ? 0 : 1;
    const sb = dataset.people.get(b)?.sex === 'male' ? 0 : 1;
    return sa - sb;
  });
}

function childrenOf(id: string, dataset: NormalizedDataset): string[] {
  return dataset.relationships
    .filter((r) => r.person_id === id && r.relationship_type.endsWith('_parent'))
    .map((r) => r.related_person_id);
}

/** Coniugi con cui la persona ha avuto figli. */
function coParentsOf(id: string, dataset: NormalizedDataset): string[] {
  const out: string[] = [];
  for (const fam of dataset.families.values()) {
    if (!(fam.partner_ids || []).includes(id) || (fam.children_ids || []).length === 0) continue;
    for (const pid of fam.partner_ids || []) if (pid !== id && !out.includes(pid)) out.push(pid);
  }
  return out;
}

function build(dataset: NormalizedDataset): SerieIndex {
  const root = getRootPersonId(dataset) ?? dataset.people.keys().next().value;
  const series: Serie[] = [];
  const byPerson = new Map<string, Serie>();
  const heads = new Map<number, string[]>();
  if (!root) return { series, byPerson, heads };

  // Coppie che aprono le serie: [padre, madre] (o [nonno/a] finché i bisnonni non sono noti).
  // Sia per la radice sia per il coniuge con cui la radice ha figli si parte dai 4 nonni:
  // per ciascun nonno la serie si apre sulla coppia dei suoi genitori (bisnonni), o sul nonno stesso.
  const couples: { couple: string[]; ramo: 'radice' | 'coniuge'; ramoId: string }[] = [];
  const addBranchSeries = (branchRoot: string, ramo: 'radice' | 'coniuge') => {
    let grand: string[] = [branchRoot];
    for (let d = 0; d < 2; d++) grand = grand.flatMap((id) => parentsOf(id, dataset));
    for (const g of grand) {
      const ps = parentsOf(g, dataset);
      couples.push({ couple: ps.length > 0 ? ps : [g], ramo, ramoId: branchRoot });
    }
  };
  addBranchSeries(root, 'radice');
  for (const spouse of coParentsOf(root, dataset)) {
    addBranchSeries(spouse, 'coniuge');
  }

  const coupleSets: Set<string>[] = [];
  couples.forEach(({ couple, ramo, ramoId }, i) => {
    const head = dataset.people.get(couple[0]);
    const s: Serie = {
      index: i + 1,
      roman: ROMAN[i + 1] || String(i + 1),
      name: head?.surname || `Serie ${i + 1}`,
      cls: `serie-${Math.min(i + 1, MAX_SERIE_CLS)}`,
      ramo,
      ramoId,
    };
    series.push(s);
    heads.set(s.index, couple);
    // antenati della coppia
    const set = new Set<string>();
    const stack = [...couple];
    while (stack.length) {
      const id = stack.pop()!;
      if (set.has(id)) continue;
      set.add(id);
      stack.push(...parentsOf(id, dataset));
    }
    coupleSets.push(set);
  });

  // Discendenti di ciascuna coppia
  const descSets: Set<string>[] = couples.map(({ couple }) => {
    const set = new Set<string>();
    const stack = couple.flatMap((id) => childrenOf(id, dataset));
    while (stack.length) {
      const id = stack.pop()!;
      if (set.has(id)) continue;
      set.add(id);
      stack.push(...childrenOf(id, dataset));
    }
    return set;
  });

  for (const person of dataset.people.values()) {
    const anc = coupleSets.findIndex((s) => s.has(person.id));
    if (anc >= 0) {
      byPerson.set(person.id, series[anc]);
      continue;
    }
    const desc = descSets.map((s, i) => (s.has(person.id) ? i : -1)).filter((i) => i >= 0);
    if (desc.length === 1) {
      byPerson.set(person.id, series[desc[0]]);
      continue;
    }
    if (desc.length === 2 && desc.every((i) => couples[i].couple.length === 1)) {
      const byDescSurname = desc.map((i) => series[i]).find((s) => s.name && person.surname === s.name);
      if (byDescSurname) {
        byPerson.set(person.id, byDescSurname);
        continue;
      }
    }
    if (desc.length === 0) {
      const bySurname = series.find((s) => s.name && person.surname === s.name);
      if (bySurname) {
        byPerson.set(person.id, bySurname);
        continue;
      }
    }
    byPerson.set(person.id, FONDO);
  }

  // Coniugi di chi è in una serie (es. la moglie di un figlio di bisnonni) restano nel fondo,
  // tranne i coniugi interni alla stessa serie già assegnati sopra.
  return { series, byPerson, heads };
}

function index(dataset: NormalizedDataset): SerieIndex {
  let idx = cache.get(dataset);
  if (!idx) {
    idx = build(dataset);
    cache.set(dataset, idx);
  }
  return idx;
}

export function serieOf(personId: string, dataset: NormalizedDataset): Serie {
  return index(dataset).byPerson.get(personId) ?? FONDO;
}

export function allSeries(dataset: NormalizedDataset): Serie[] {
  return index(dataset).series;
}

/** La coppia di bisnonni che apre la serie (padre, madre). */
export function serieHeads(serie: Serie, dataset: NormalizedDataset): string[] {
  return index(dataset).heads.get(serie.index) ?? [];
}

/** Numero di fascicolo leggibile dall'ID: P036_rossi_mario → 36. */
export function fascicolo(id: string): string {
  const m = /^[A-Z]+0*(\d+)/.exec(id);
  return m ? m[1] : id;
}
