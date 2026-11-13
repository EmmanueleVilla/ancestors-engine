import type { DateValue } from '../model/date.js';
import type { DatasetIndex, ValidationError } from './reference.js';
import { buildParentsOf, directAncestorsOf, isParentRelationship, missingParents, type LineageRelationship } from './lineage.js';

/**
 * Controlli di coerenza "morbidi": non bloccano la build (salvo `--strict`),
 * perché in genealogia esistono casi strani ma veri. Segnalano però gli errori
 * tipici di trascrizione: date impossibili, età dei genitori, eventi collegati
 * alla persona sbagliata, record che nessuno richiama.
 */

/** Intervallo [min, max] in anni frazionari entro cui cade la data. */
interface Bounds {
  min: number;
  max: number;
}

const TOLERANCE: Partial<Record<DateValue['precision'], number>> = {
  approximate: 3,
  estimated: 5,
  uncertain: 5,
};

function point(y: number, m?: number, d?: number): number {
  return y + ((m ?? 1) - 1) / 12 + ((d ?? 1) - 1) / 365;
}

function periodEnd(y: number, m?: number, d?: number): number {
  if (d !== undefined && m !== undefined) return point(y, m, d) + 1 / 365;
  if (m !== undefined) return point(y, m) + 1 / 12;
  return y + 1;
}

export function dateBounds(date?: DateValue | null): Bounds | null {
  if (!date || date.year === undefined) return null;
  const start = point(date.year, date.month, date.day);
  const end = periodEnd(date.year, date.month, date.day);
  switch (date.precision) {
    case 'before':
      return { min: -Infinity, max: end };
    case 'after':
      return { min: start, max: Infinity };
    case 'range': {
      if (date.end_year === undefined) return { min: start, max: Infinity };
      return { min: start, max: periodEnd(date.end_year, date.end_month, date.end_day) };
    }
    default: {
      const tol = TOLERANCE[date.precision] ?? 0;
      return { min: start - tol, max: end + tol };
    }
  }
}

/** Vero solo se `a` è sicuramente successiva a `b` di più di `gap` anni. */
function surelyAfter(a: Bounds | null, b: Bounds | null, gap = 0): boolean {
  return !!a && !!b && a.min - b.max > gap;
}

const PARENT_MIN_AGE = 13;
const MOTHER_MAX_AGE = 55;
const FATHER_MAX_AGE = 75;
const MAX_LIFESPAN = 110;
/** Un figlio può nascere fino a ~10 mesi dopo la morte del padre. */
const POSTHUMOUS_GAP = 0.85;

const EXPECTED_EVENT_TYPES: Record<string, string[]> = {
  birth_event_id: ['birth', 'baptism', 'christening'],
  death_event_id: ['death'],
  burial_event_id: ['burial'],
  start_event_id: ['marriage', 'civil_union', 'partnership'],
  end_event_id: ['divorce', 'separation'],
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Riferimenti dal registro ricerche: contano come "usati" anche se nessuna scheda li richiama. */
export interface ExtraReferences {
  media?: Iterable<string>;
  records?: Iterable<string>;
  /** Relazioni, comprese quelle derivate dalle famiglie: servono per contare i genitori. */
  relationships?: LineageRelationship[];
  /** Radice dell'albero (`tree.root_id`): attiva i controlli sugli antenati diretti. */
  rootId?: string;
}

/** Persona vivente riservata: il sito non ne mostra i dettagli. */
const LIVING_RESTRICTED = 'living-person restricted';

/** Tag che dichiara una persona volutamente fuori dall'albero (trovata negli atti, legame non provato). */
const DETACHED_TAG = 'scollegato';

const POSTHUMOUS_EVENT_TYPES = new Set([
  'death',
  'burial',
  'probate',
]);

/**
 * Tag che dichiara la fonte di una persona: la conoscenza diretta del ricercatore o della famiglia
 * (di solito le generazioni viventi). Sostituisce la citazione nel controllo "senza fonti".
 */
export const DIRECT_KNOWLEDGE_TAG = 'conoscenza_diretta';

export function checkConsistency(index: DatasetIndex, extra: ExtraReferences = {}): ValidationError[] {
  const warnings: ValidationError[] = [];
  const warn = (filePath: string, field: string, message: string) => warnings.push({ filePath, field, message });

  const eventDate = (id?: string): Bounds | null =>
    id ? dateBounds(index.events.get(id)?.data?.date) : null;
  const birthOf = (pid: string) => eventDate(index.people.get(pid)?.data?.birth_event_id);
  const deathOf = (pid: string) => eventDate(index.people.get(pid)?.data?.death_event_id);
  const nameOf = (pid: string) => {
    const p = index.people.get(pid)?.data;
    return p ? `${p.given_names ?? ''} ${p.surname ?? ''}`.trim() || pid : pid;
  };

  const checkEventType = (file: string, field: string, eventId?: string) => {
    if (!eventId) return;
    const evt = index.events.get(eventId)?.data;
    const expected = EXPECTED_EVENT_TYPES[field];
    if (evt && expected && !expected.includes(evt.event_type)) {
      warn(file, field, `L'evento '${eventId}' è di tipo '${evt.event_type}', atteso ${expected.join('/')}.`);
    }
  };

  const eventsByPerson = new Map<string, string[]>();
  for (const [eid, { data: evt }] of index.events) {
    for (const pid of evt.person_ids ?? []) {
      if (!eventsByPerson.has(pid)) eventsByPerson.set(pid, []);
      eventsByPerson.get(pid)!.push(eid);
    }
  }

  // ---- Persone ----
  for (const [pid, { data: p, filePath }] of index.people) {
    for (const field of ['birth_event_id', 'death_event_id', 'burial_event_id'] as const) {
      const eventId = p[field];
      if (!eventId) continue;
      checkEventType(filePath, field, eventId);
      const evt = index.events.get(eventId)?.data;
      if (evt && evt.person_ids?.length && !evt.person_ids.includes(pid)) {
        warn(filePath, field, `L'evento '${eventId}' non elenca questa persona nei suoi person_ids.`);
      }
    }

    const birth = eventDate(p.birth_event_id);
    const death = eventDate(p.death_event_id);
    const burial = eventDate(p.burial_event_id);
    if (surelyAfter(birth, death)) warn(filePath, 'death_event_id', `Morte precedente alla nascita.`);
    if (surelyAfter(death, burial)) warn(filePath, 'burial_event_id', `Sepoltura precedente alla morte.`);
    if (birth && death && death.min - birth.max > MAX_LIFESPAN) {
      warn(filePath, 'death_event_id', `Vita di oltre ${MAX_LIFESPAN} anni: controllare le date.`);
    }

    const currentYear = new Date().getFullYear();

    if (p.privacy === LIVING_RESTRICTED) {
      if (p.death_event_id || p.burial_event_id) {
        warn(filePath, 'privacy', `Persona con evento di morte/sepoltura (${nameOf(pid)}) ma marcata '${LIVING_RESTRICTED}'.`);
      }
      if (birth && currentYear - birth.min > MAX_LIFESPAN) {
        warn(filePath, 'privacy', `Persona nata oltre ${MAX_LIFESPAN} anni fa (${nameOf(pid)}) marcata '${LIVING_RESTRICTED}': non può essere considerata vivente.`);
      }
    }

    const personEventIds = eventsByPerson.get(pid) ?? [];

    // Battesimo antecedente alla nascita
    for (const eid of personEventIds) {
      const evt = index.events.get(eid)?.data;
      if (evt && (evt.event_type === 'baptism' || evt.event_type === 'christening')) {
        const bapDate = eventDate(eid);
        if (surelyAfter(birth, bapDate)) {
          warn(filePath, 'birth_event_id', `Battesimo antecedente alla nascita per ${nameOf(pid)}.`);
        }
      }
    }

    // Eventi vitali attivi post-mortem o prima della nascita
    for (const eid of personEventIds) {
      const evt = index.events.get(eid)?.data;
      if (!evt) continue;
      const ed = eventDate(eid);
      if (death && !POSTHUMOUS_EVENT_TYPES.has(evt.event_type)) {
        if (surelyAfter(ed, death, 0.05)) {
          warn(filePath, 'death_event_id', `L'evento '${eid}' di tipo '${evt.event_type}' si svolge dopo la morte di ${nameOf(pid)}.`);
        }
      }
      if (birth && evt.event_type !== 'birth' && evt.event_type !== 'baptism' && evt.event_type !== 'christening') {
        if (surelyAfter(birth, ed, 0.05)) {
          warn(filePath, 'birth_event_id', `L'evento '${eid}' di tipo '${evt.event_type}' si svolge prima della nascita di ${nameOf(pid)}.`);
        }
      }
    }

    // Spostamento a velocità impossibile prima del 1920
    const datedGeoEvents: { id: string; date: Bounds; lat: number; lon: number; placeName: string }[] = [];
    for (const eid of personEventIds) {
      const evt = index.events.get(eid)?.data;
      const d = eventDate(eid);
      if (!evt || !d || d.max >= 1920 || d.max - d.min > 3 / 365 || !evt.place_id) continue;
      const plc = index.places.get(evt.place_id)?.data;
      if (plc && typeof plc.latitude === 'number' && typeof plc.longitude === 'number') {
        datedGeoEvents.push({ id: eid, date: d, lat: plc.latitude, lon: plc.longitude, placeName: plc.name });
      }
    }
    datedGeoEvents.sort((a, b) => a.date.min - b.date.min);
    for (let i = 0; i < datedGeoEvents.length - 1; i++) {
      const e1 = datedGeoEvents[i];
      const e2 = datedGeoEvents[i + 1];
      const yearsDiff = e2.date.min - e1.date.max;
      const hours = Math.max(1, yearsDiff * 365.25 * 24);
      if (hours <= 72) {
        const dist = haversineKm(e1.lat, e1.lon, e2.lat, e2.lon);
        if (dist > 100 && dist / hours > 50) {
          warn(
            filePath,
            'id',
            `Spostamento apparentemente impossibile per ${nameOf(pid)} tra '${e1.id}' (${e1.placeName}) e '${e2.id}' (${e2.placeName}): ${Math.round(dist)} km in circa ${Math.round(hours)} ore (velocità ${Math.round(dist / hours)} km/h prima del 1920): verificare possibile omonimia.`
          );
        }
      }
    }
  }

  // Eventi di nascita/morte a persona singola che la persona non richiama.
  const linkField: Record<string, string> = { birth: 'birth_event_id', death: 'death_event_id', burial: 'burial_event_id' };
  for (const [eid, { data: evt, filePath }] of index.events) {
    const field = linkField[evt.event_type];
    if (!field || evt.person_ids?.length !== 1) continue;
    const person = index.people.get(evt.person_ids[0])?.data;
    if (person && person[field] !== eid) {
      warn(
        filePath,
        'person_ids',
        `Evento di tipo '${evt.event_type}' di ${nameOf(evt.person_ids[0])}, ma la persona ha ${field}: ${person[field] ?? '(vuoto)'}.`
      );
    }
  }

  // ---- Famiglie ----
  for (const [, { data: fam, filePath }] of index.families) {
    const partners: string[] = fam.partner_ids ?? [];
    checkEventType(filePath, 'start_event_id', fam.start_event_id);
    checkEventType(filePath, 'end_event_id', fam.end_event_id);

    if (partners.length === 2) {
      const [a, b] = partners.map((id) => index.people.get(id)?.data?.sex);
      if (a && a === b && (a === 'male' || a === 'female')) {
        warn(filePath, 'partner_ids', `Entrambi i partner hanno sex: ${a}.`);
      }
    }

    const union = eventDate(fam.start_event_id);
    const endUnion = eventDate(fam.end_event_id);
    if (union && endUnion && surelyAfter(union, endUnion)) {
      warn(filePath, 'end_event_id', `L'evento di fine unione '${fam.end_event_id}' è precedente all'evento di inizio '${fam.start_event_id}'.`);
    }

    for (const partner of partners) {
      if (union && surelyAfter(birthOf(partner), union, -PARENT_MIN_AGE)) {
        warn(filePath, 'start_event_id', `${nameOf(partner)} si sposa prima dei ${PARENT_MIN_AGE} anni (o prima di nascere).`);
      }
      if (surelyAfter(union, deathOf(partner))) {
        warn(filePath, 'start_event_id', `Matrimonio successivo alla morte di ${nameOf(partner)}.`);
      }
    }

    for (const child of fam.children_ids ?? []) {
      const childBirth = birthOf(child);
      if (!childBirth) continue;
      for (const parent of partners) {
        const sex = index.people.get(parent)?.data?.sex;
        const parentBirth = birthOf(parent);
        const parentDeath = deathOf(parent);
        const who = `${nameOf(parent)} → ${nameOf(child)}`;
        if (parentBirth && childBirth.max - parentBirth.min < PARENT_MIN_AGE) {
          warn(filePath, 'children_ids', `${who}: genitore con meno di ${PARENT_MIN_AGE} anni alla nascita del figlio.`);
        }
        const maxAge = sex === 'female' ? MOTHER_MAX_AGE : FATHER_MAX_AGE;
        if (parentBirth && childBirth.min - parentBirth.max > maxAge) {
          warn(filePath, 'children_ids', `${who}: genitore con più di ${maxAge} anni alla nascita del figlio.`);
        } else if (sex === 'male' && parentBirth && childBirth.min - parentBirth.max > 65) {
          warn(filePath, 'children_ids', `${who}: paternità in età avanzata (tra 65 e 75 anni, a circa ${Math.round(childBirth.min - parentBirth.max)} anni): verificare possibile omonimia.`);
        }
        const gap = sex === 'female' ? 0 : POSTHUMOUS_GAP;
        if (surelyAfter(childBirth, parentDeath, gap)) {
          warn(filePath, 'children_ids', `${who}: figlio nato dopo la morte del genitore.`);
        }
      }
    }
  }

  // Intervallo intergenesico minimo tra figli della stessa madre
  const childrenByMother = new Map<string, { childId: string; famFile: string; birth: Bounds }[]>();
  for (const [, { data: fam, filePath: famFilePath }] of index.families) {
    const mothers = (fam.partner_ids ?? []).filter((id: string) => index.people.get(id)?.data?.sex === 'female');
    for (const mId of mothers) {
      if (!childrenByMother.has(mId)) childrenByMother.set(mId, []);
      for (const childId of fam.children_ids ?? []) {
        const b = birthOf(childId);
        if (b && b.max - b.min <= 1) {
          childrenByMother.get(mId)!.push({ childId, famFile: famFilePath, birth: b });
        }
      }
    }
  }
  for (const [mId, kids] of childrenByMother) {
    kids.sort((a, b) => a.birth.min - b.birth.min);
    for (let i = 0; i < kids.length - 1; i++) {
      const k1 = kids[i];
      const k2 = kids[i + 1];
      const gap = k2.birth.min - k1.birth.max;
      if (gap > 3 / 365 && k2.birth.max - k1.birth.min < 0.70) {
        warn(
          k2.famFile,
          'children_ids',
          `Intervallo intergenesico anomalo tra ${nameOf(k1.childId)} e ${nameOf(k2.childId)} (stessa madre ${nameOf(mId)}): nati a distanza di meno di 8.5 mesi senza essere gemelli.`
        );
      }
    }
  }

  // Bigamia o unioni sovrapposte non documentate
  const familiesByPartner = new Map<string, { famId: string; filePath: string; start: Bounds | null; end: Bounds | null; spouseId?: string }[]>();
  for (const [fid, { data: fam, filePath: famFilePath }] of index.families) {
    const partners = fam.partner_ids ?? [];
    if (partners.length === 2) {
      for (let i = 0; i < 2; i++) {
        const p = partners[i];
        const spouse = partners[1 - i];
        if (!familiesByPartner.has(p)) familiesByPartner.set(p, []);
        familiesByPartner.get(p)!.push({
          famId: fid,
          filePath: famFilePath,
          start: eventDate(fam.start_event_id),
          end: eventDate(fam.end_event_id),
          spouseId: spouse,
        });
      }
    }
  }
  for (const [pId, famList] of familiesByPartner) {
    if (famList.length < 2) continue;
    const sorted = famList.filter((f) => f.start !== null).sort((a, b) => a.start!.min - b.start!.min);
    for (let i = 0; i < sorted.length - 1; i++) {
      const f1 = sorted[i];
      const f2 = sorted[i + 1];
      const spouse1Death = f1.spouseId ? deathOf(f1.spouseId) : null;
      // Segnala unione sovrapposta/bigamia solo se vi è prova esplicita che il primo coniuge
      // fosse ancora in vita alla data delle seconde nozze e l'unione precedente non risulti sciolta.
      const spouse1EvidentlyAlive = !!spouse1Death && surelyAfter(spouse1Death, f2.start);
      const f1NotEnded = !f1.end || surelyAfter(f1.end, f2.start);
      if (spouse1EvidentlyAlive && f1NotEnded && surelyAfter(f2.start, f1.start)) {
        warn(
          f2.filePath,
          'start_event_id',
          `Possibile unione sovrapposta o bigamia per ${nameOf(pId)} tra la famiglia '${f1.famId}' e '${f2.famId}': il primo coniuge (${nameOf(f1.spouseId!)}) risulta deceduto dopo l'inizio della seconda unione.`
        );
      }
    }
  }

  // ---- parents_next_step: stessa logica di albero e scheda persona ----
  // Il testo compare nella scheda persona se la persona non è riservata e ha meno di due legami
  // genitore (pages/person.ts), e sul segnaposto "?" dell'albero se è un antenato diretto
  // della radice a cui manca il padre o la madre (components/tree.ts).
  const relationships = extra.relationships ?? [];
  const familyData = [...index.families.values()].map((f) => f.data);
  const parentsOf = buildParentsOf(familyData, relationships);
  const parentRelCount = new Map<string, number>();
  for (const rel of relationships) {
    if (isParentRelationship(rel)) parentRelCount.set(rel.related_person_id, (parentRelCount.get(rel.related_person_id) ?? 0) + 1);
  }
  const isRestricted = (pid: string) => index.people.get(pid)?.data?.privacy === LIVING_RESTRICTED;
  const missingOf = (pid: string) =>
    missingParents([...(parentsOf.get(pid) || [])].map((id) => index.people.get(id)?.data?.sex));
  const hasNextStep = (p: { parents_next_step?: string }) => !!p.parents_next_step?.trim();

  const rootId = extra.rootId && index.people.has(extra.rootId) ? extra.rootId : undefined;
  const directAncestors = rootId ? directAncestorsOf(rootId, familyData, parentsOf) : [];
  const ancestorSet = new Set(directAncestors);

  for (const [pid, { data: p, filePath }] of index.people) {
    if (!hasNextStep(p)) continue;
    const shownOnPage = !isRestricted(pid) && (parentRelCount.get(pid) ?? 0) < 2;
    const shownOnTree = ancestorSet.has(pid) && !isRestricted(pid) && missingOf(pid) !== null;
    if (!shownOnPage && !shownOnTree) {
      const parentNames = [...(parentsOf.get(pid) || [])].map(nameOf).join(' e ');
      warn(
        filePath,
        'parents_next_step',
        isRestricted(pid)
          ? `Persona riservata (vivente): parents_next_step non viene mostrato né nell'albero né nella scheda persona.`
          : `La persona ha già i genitori documentati (${parentNames}): parents_next_step non viene mostrato né nell'albero né nella scheda persona.`
      );
    }
  }

  for (const pid of directAncestors) {
    const entry = index.people.get(pid);
    if (!entry || isRestricted(pid) || hasNextStep(entry.data)) continue;
    const missing = missingOf(pid);
    if (!missing) continue;
    const what = missing === 'both' ? 'padre e madre' : missing === 'father' ? 'il padre' : 'la madre';
    warn(
      entry.filePath,
      'parents_next_step',
      `Antenato diretto (${nameOf(pid)}) senza ${what} e senza parents_next_step: indica come cercarli, il testo compare sul segnaposto "?" dell'albero.`
    );
  }

  // ---- Record che nessuno richiama ----
  const inFamily = new Set<string>();
  for (const { data: fam } of index.families.values()) {
    for (const id of [...(fam.partner_ids ?? []), ...(fam.children_ids ?? [])]) inFamily.add(id);
  }
  const referencedEvents = new Set<string>();
  const referencedCitations = new Set<string>();
  const referencedMedia = new Set<string>();
  const citedSources = new Set<string>();
  for (const id of extra.media ?? []) referencedMedia.add(id);
  for (const id of extra.records ?? []) {
    referencedEvents.add(id);
    citedSources.add(id);
  }
  const collect = (d: any) => {
    for (const f of ['birth_event_id', 'death_event_id', 'burial_event_id', 'start_event_id', 'end_event_id']) {
      if (d[f]) referencedEvents.add(d[f]);
    }
    for (const id of d.source_citation_ids ?? []) referencedCitations.add(id);
    for (const id of d.media_ids ?? []) referencedMedia.add(id);
    for (const ids of Object.values(d.child_citation_ids ?? {}) as string[][]) {
      for (const id of ids) referencedCitations.add(id);
    }
  };
  for (const cat of ['people', 'families', 'events', 'relationships'] as const) {
    for (const { data } of index[cat].values()) collect(data);
  }
  for (const { data: cit } of index.citations.values()) {
    citedSources.add(cit.source_id);
    if (cit.event_id) referencedEvents.add(cit.event_id);
  }
  for (const { data: med } of index.media.values()) {
    if (med.source_id) citedSources.add(med.source_id);
    for (const id of med.event_ids ?? []) referencedEvents.add(id);
  }

  for (const [pid, { data: p, filePath }] of index.people) {
    if (!inFamily.has(pid) && !p.tags?.includes(DETACHED_TAG)) warn(filePath, 'id', `Persona non collegata a nessuna famiglia.`);
  }

  // Ogni persona, famiglia, evento e relazione ha una fonte: una citazione, oppure il tag conoscenza_diretta.
  // Il controllo vale solo se il dataset usa le citazioni (un dataset di prova senza citazioni non lo attiva).
  if (index.citations.size > 0) {
    const citedPeople = new Set<string>();
    const citedFamilies = new Set<string>();
    const citedEvents = new Set<string>();
    const citedRelationships = new Set<string>();
    for (const { data: cit } of index.citations.values()) {
      if (cit.person_id) citedPeople.add(cit.person_id);
      if (cit.family_id) citedFamilies.add(cit.family_id);
      if (cit.event_id) citedEvents.add(cit.event_id);
      if (cit.relationship_id) citedRelationships.add(cit.relationship_id);
    }
    for (const [fid, { data: fam }] of index.families) {
      for (const [childId, ids] of Object.entries(fam.child_citation_ids ?? {}) as [string, string[]][]) {
        if (ids.length > 0) {
          citedPeople.add(childId);
          citedFamilies.add(fid);
        }
      }
    }
    const eventHasCitation = (eid?: string): boolean =>
      !!eid && (citedEvents.has(eid) || !!(index.events.get(eid)?.data?.source_citation_ids?.length));
    const directKnowledge = (pid: string) => !!index.people.get(pid)?.data?.tags?.includes(DIRECT_KNOWLEDGE_TAG);

    for (const [pid, { data: p, filePath }] of index.people) {
      if (p.source_citation_ids?.length || citedPeople.has(pid) || directKnowledge(pid)) continue;
      warn(filePath, 'source_citation_ids', `Persona senza fonti: aggiungi una citazione o il tag ${DIRECT_KNOWLEDGE_TAG}.`);
    }

    for (const [fid, { data: fam, filePath }] of index.families) {
      const partners: string[] = fam.partner_ids ?? [];
      const allPartnersDK = partners.length > 0 && partners.every(directKnowledge);
      const hasFamEventCit = eventHasCitation(fam.start_event_id) || eventHasCitation(fam.end_event_id);
      if (!fam.source_citation_ids?.length && !citedFamilies.has(fid) && !hasFamEventCit && !allPartnersDK) {
        warn(filePath, 'source_citation_ids', `Famiglia senza fonti: aggiungi una citazione (anche child_citation_ids).`);
        continue;
      }

      // Singoli legami genitore-figlio (children_ids): avviso non bloccante se manca la fonte del legame.
      const famCitIds = new Set<string>(fam.source_citation_ids ?? []);
      for (const [cid, { data: cit }] of index.citations) {
        if (cit.family_id === fid) famCitIds.add(cid);
        if (cit.event_id && (cit.event_id === fam.start_event_id || cit.event_id === fam.end_event_id)) famCitIds.add(cid);
      }
      for (const eid of [fam.start_event_id, fam.end_event_id]) {
        for (const cid of index.events.get(eid ?? '')?.data?.source_citation_ids ?? []) famCitIds.add(cid);
      }

      for (const childId of fam.children_ids ?? []) {
        if (directKnowledge(childId) || allPartnersDK) continue;
        if (fam.child_citation_ids?.[childId]?.length) continue;

        const child = index.people.get(childId)?.data;
        const childEvents = [child?.birth_event_id, child?.death_event_id, child?.burial_event_id].filter(Boolean) as string[];
        const childCitIds = new Set<string>(child?.source_citation_ids ?? []);
        for (const eid of childEvents) {
          for (const cid of index.events.get(eid)?.data?.source_citation_ids ?? []) childCitIds.add(cid);
        }
        for (const [cid, { data: cit }] of index.citations) {
          if (cit.person_id === childId) childCitIds.add(cid);
          if (cit.event_id && childEvents.includes(cit.event_id)) childCitIds.add(cid);
        }

        const hasChildLinkSource = [...childCitIds].some((cid) => {
          const cit = index.citations.get(cid)?.data;
          return famCitIds.has(cid) || (cit && (cit.family_id === fid || /parentage/.test(cit.claim_type)));
        });
        if (!hasChildLinkSource) {
          warn(
            filePath,
            'children_ids',
            `Legame genitore-figlio senza fonti per ${nameOf(childId)} (${childId}): aggiungi una citazione (anche in child_citation_ids) o il tag ${DIRECT_KNOWLEDGE_TAG}.`
          );
        }
      }
    }

    for (const [eid, { data: evt, filePath }] of index.events) {
      if (evt.source_citation_ids?.length || citedEvents.has(eid)) continue;
      const famPartners: string[] = evt.family_id ? (index.families.get(evt.family_id)?.data?.partner_ids ?? []) : [];
      const involved = [...new Set<string>([...(evt.person_ids ?? []), ...famPartners])];
      if (involved.length > 0 && involved.every(directKnowledge)) continue;
      warn(filePath, 'source_citation_ids', `Evento senza fonti: aggiungi una citazione o il tag ${DIRECT_KNOWLEDGE_TAG}.`);
    }

    for (const [rid, { data: rel, filePath }] of index.relationships) {
      const hasRelEventCit = eventHasCitation(rel.start_event_id) || eventHasCitation(rel.end_event_id);
      if (rel.source_citation_ids?.length || citedRelationships.has(rid) || hasRelEventCit) continue;
      if (rel.person_id && rel.related_person_id && directKnowledge(rel.person_id) && directKnowledge(rel.related_person_id)) continue;
      warn(filePath, 'source_citation_ids', `Relazione senza fonti: aggiungi una citazione o il tag ${DIRECT_KNOWLEDGE_TAG}.`);
    }
  }
  for (const [eid, { data: evt, filePath }] of index.events) {
    if (!referencedEvents.has(eid) && !evt.person_ids?.length && !evt.family_id) {
      warn(filePath, 'id', `Evento non collegato a nessuna persona o famiglia.`);
    }
  }
  for (const [cid, { data: cit, filePath }] of index.citations) {
    if (!referencedCitations.has(cid) && !cit.person_id && !cit.event_id && !cit.family_id && !cit.relationship_id) {
      warn(filePath, 'id', `Citazione non collegata a nessun record.`);
    }
  }
  for (const [sid, { filePath }] of index.sources) {
    if (!citedSources.has(sid)) warn(filePath, 'id', `Fonte senza citazioni né media.`);
  }
  for (const [mid, { data: med, filePath }] of index.media) {
    if (!referencedMedia.has(mid) && !med.person_ids?.length && !med.event_ids?.length && !med.source_id) {
      warn(filePath, 'id', `Media non collegato a nessun record.`);
    }
  }

  return warnings;
}
