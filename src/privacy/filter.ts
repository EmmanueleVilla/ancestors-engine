import { createHmac } from 'node:crypto';
import { NormalizedDataset } from '../validator/index.js';
import { Person } from '../model/person.js';
import { inferLivingAndPrivateEntities } from './inference.js';

export interface PrivacyOptions {
  /** Persone vive che mantengono nome e ID nel profilo pubblico (dettagli comunque nascosti). */
  namedLivingIds?: string[];
  /** Chiave per gli pseudonimi stabili degli ID delle persone vive. */
  pseudonymKey?: string;
}

export interface PublicProfileResult {
  dataset: NormalizedDataset;
  /** ID originale → pseudonimo, per le persone vive mascherate. */
  idMap: Map<string, string>;
  /** ID originali delle persone vive mascherate (senza i nominati). */
  maskedIds: Set<string>;
}

/**
 * Pseudonimo stabile di un ID: lo stesso ID con la stessa chiave dà sempre lo stesso codice,
 * così i link del sito pubblico non cambiano da un build all'altro.
 * Gli ID contengono nome e cognome (P011_rossi_maria): nel profilo pubblico non devono comparire.
 */
export function pseudonymFor(id: string, key: string = ''): string {
  return 'L-' + createHmac('sha256', key).update(id).digest('hex').slice(0, 10);
}

function maskPerson(person: Person, keepName: boolean): Person {
  return {
    ...person,
    given_names: keepName ? person.given_names : '',
    surname: keepName ? person.surname : '[Living]',
    maiden_name: undefined,
    birth_name: undefined,
    preferred_name: keepName ? person.preferred_name : undefined,
    nickname: undefined,
    alternative_names: [],
    titles: [],
    occupations: [],
    religion: undefined,
    nationalities: [],
    biography: undefined,
    notes: [],
    tags: [],
    birth_event_id: undefined,
    death_event_id: undefined,
    burial_event_id: undefined,
    media_ids: [],
    source_citation_ids: [],
    privacy: keepName ? undefined : 'living-person restricted',
  };
}

/** Sostituisce gli ID mappati ovunque: valori, chiavi degli oggetti e testo libero. */
function makeRemapper(idMap: Map<string, string>): (value: any) => any {
  if (idMap.size === 0) return (v) => v;
  const escaped = [...idMap.keys()]
    .sort((a, b) => b.length - a.length)
    .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(?<![A-Za-z0-9_])(${escaped.join('|')})(?![A-Za-z0-9_])`, 'g');
  const remapString = (s: string) => s.replace(re, (m) => idMap.get(m) ?? m);
  const remap = (value: any): any => {
    if (typeof value === 'string') return remapString(value);
    if (Array.isArray(value)) return value.map(remap);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) out[remapString(k)] = remap(v);
      return out;
    }
    return value;
  };
  return remap;
}

function remapMap<T>(map: Map<string, T>, remap: (v: any) => any): Map<string, T> {
  const out = new Map<string, T>();
  for (const [k, v] of map.entries()) out.set(remap(k), remap(v));
  return out;
}

export function applyPublicProfile(dataset: NormalizedDataset, options: PrivacyOptions = {}): PublicProfileResult {
  const named = new Set(options.namedLivingIds ?? []);
  const { livingPersonIds, privateEntityIds } = inferLivingAndPrivateEntities(dataset);
  const maskedIds = new Set([...livingPersonIds].filter((id) => !named.has(id)));

  const filteredPeople = new Map<string, Person>();
  for (const [id, person] of dataset.people.entries()) {
    if (privateEntityIds.has(id)) continue; // entità del tutto privata: omessa
    if (livingPersonIds.has(id)) filteredPeople.set(id, maskPerson(person, named.has(id)));
    else filteredPeople.set(id, { ...person });
  }

  // Media: omessi se ritraggono solo persone vive
  const filteredMedia = new Map();
  for (const [id, med] of dataset.media.entries()) {
    if (privateEntityIds.has(id)) continue;
    const depictsOnlyLiving =
      med.person_ids && med.person_ids.length > 0 && med.person_ids.every((pId: string) => livingPersonIds.has(pId));
    if (depictsOnlyLiving) continue;
    filteredMedia.set(id, { ...med });
  }

  // Eventi: omessi se riguardano solo persone vive
  const filteredEvents = new Map();
  for (const [id, evt] of dataset.events.entries()) {
    const isLivingOnlyEvent =
      evt.person_ids && evt.person_ids.length > 0 && evt.person_ids.every((pId: string) => livingPersonIds.has(pId));
    if (isLivingOnlyEvent) continue;
    filteredEvents.set(id, { ...evt });
  }

  // Famiglie con almeno un partner vivo: niente note in chiaro
  const filteredFamilies = new Map();
  for (const [id, fam] of dataset.families.entries()) {
    const hasLivingPartner = (fam.partner_ids ?? []).some((pId: string) => livingPersonIds.has(pId));
    if (!hasLivingPartner) {
      filteredFamilies.set(id, { ...fam });
      continue;
    }
    filteredFamilies.set(id, {
      ...fam,
      notes: [],
      ...(fam.unrecorded_children ? { unrecorded_children: { count: fam.unrecorded_children.count } } : {}),
    });
  }

  // Citazioni che hanno per soggetto una persona viva: resta il riferimento, non il testo
  const filteredCitations = new Map();
  for (const [id, cit] of dataset.citations.entries()) {
    if (cit.person_id && livingPersonIds.has(cit.person_id)) {
      filteredCitations.set(id, { ...cit, quoted_text: undefined, notes: [] });
    } else {
      filteredCitations.set(id, { ...cit });
    }
  }

  // Registro ricerche: omesse le voci che riguardano persone vive o private
  const filteredResearch = (dataset.research || []).filter(
    (r) => !r.references.some((ref) => livingPersonIds.has(ref) || privateEntityIds.has(ref))
  );

  const masked: NormalizedDataset = {
    ...dataset,
    people: filteredPeople,
    families: filteredFamilies,
    events: filteredEvents,
    citations: filteredCitations,
    media: filteredMedia,
    research: filteredResearch,
  };

  // Pseudonimi: gli ID delle persone vive mascherate spariscono da file, link, JSON e testo
  const idMap = new Map<string, string>();
  for (const id of maskedIds) idMap.set(id, pseudonymFor(id, options.pseudonymKey ?? ''));
  const remap = makeRemapper(idMap);

  const result: NormalizedDataset = {
    people: remapMap(masked.people, remap),
    families: remapMap(masked.families, remap),
    relationships: remap(masked.relationships),
    events: remapMap(masked.events, remap),
    places: remapMap(masked.places, remap),
    sources: remapMap(masked.sources, remap),
    citations: remapMap(masked.citations, remap),
    media: remapMap(masked.media, remap),
    research: remap(masked.research ?? []),
  };

  return { dataset: result, idMap, maskedIds };
}

export function applyPrivacyFilter(
  dataset: NormalizedDataset,
  profile: 'public' | 'private' = 'public',
  options: PrivacyOptions = {}
): NormalizedDataset {
  if (profile === 'private') return dataset;
  return applyPublicProfile(dataset, options).dataset;
}
