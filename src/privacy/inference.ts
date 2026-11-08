import { NormalizedDataset } from '../validator/index.js';
import { getApproximateYear } from '../model/date.js';

export interface LivingInferenceResult {
  livingPersonIds: Set<string>;
  privateEntityIds: Set<string>;
}

export function inferLivingAndPrivateEntities(
  dataset: NormalizedDataset,
  currentYear: number = new Date().getFullYear()
): LivingInferenceResult {
  const livingPersonIds = new Set<string>();
  const privateEntityIds = new Set<string>();

  // Helper to get birth year directly
  const getKnownBirthYear = (personId: string): number | null => {
    const p = dataset.people.get(personId);
    if (!p) return null;
    if (p.birth_event_id) {
      const bEvt = dataset.events.get(p.birth_event_id);
      const y = getApproximateYear(bEvt?.date);
      if (y) return y;
    }
    // Also check baptism
    for (const evt of dataset.events.values()) {
      if (evt.person_ids?.includes(personId) && (evt.event_type === 'birth' || evt.event_type === 'baptism')) {
        const y = getApproximateYear(evt.date);
        if (y) return y;
      }
    }
    return null;
  };

  const hasDeathEvent = (personId: string): boolean => {
    const p = dataset.people.get(personId);
    if (!p) return false;
    if (p.death_event_id || p.burial_event_id) return true;
    for (const evt of dataset.events.values()) {
      if (evt.person_ids?.includes(personId) && (evt.event_type === 'death' || evt.event_type === 'burial')) {
        return true;
      }
    }
    return false;
  };

  // Build adjacency for BFS: personId -> Array<{ neighborId: string; offset: number }>
  const adj = new Map<string, Array<{ neighborId: string; offset: number }>>();

  const addEdge = (from: string, to: string, offset: number) => {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push({ neighborId: to, offset });
  };

  // 1. Edges from relationships
  for (const rel of dataset.relationships) {
    if (rel.relationship_type.endsWith('_parent')) {
      // rel.person_id is parent of rel.related_person_id
      // From child to parent: parent was born ~30 years before child (-30)
      addEdge(rel.related_person_id, rel.person_id, -30);
      // From parent to child: child was born ~30 years after parent (+30)
      addEdge(rel.person_id, rel.related_person_id, 30);
    } else if (rel.relationship_type === 'spouse' || rel.relationship_type === 'partner') {
      addEdge(rel.person_id, rel.related_person_id, 0);
      addEdge(rel.related_person_id, rel.person_id, 0);
    }
  }

  // 2. Edges from families (partners)
  for (const fam of dataset.families.values()) {
    const partners = fam.partner_ids || [];
    for (let i = 0; i < partners.length; i++) {
      for (let j = i + 1; j < partners.length; j++) {
        addEdge(partners[i], partners[j], 0);
        addEdge(partners[j], partners[i], 0);
      }
    }
  }

  // BFS to estimate birth year if unknown
  const estimateBirthYear = (personId: string): number | null => {
    const visited = new Set<string>();
    const queue: Array<{ id: string; accumulatedOffset: number }> = [{ id: personId, accumulatedOffset: 0 }];
    visited.add(personId);

    while (queue.length > 0) {
      const { id, accumulatedOffset } = queue.shift()!;
      const knownYear = getKnownBirthYear(id);
      if (knownYear !== null && id !== personId) {
        // Person's estimated birth year = relative's known year - accumulatedOffset
        // Example: neighbor is parent (offset -30 from person). knownYear is 1950.
        // person was born: 1950 - (-30) = 1980.
        return knownYear - accumulatedOffset;
      }

      const neighbors = adj.get(id) || [];
      for (const edge of neighbors) {
        if (!visited.has(edge.neighborId)) {
          visited.add(edge.neighborId);
          queue.push({
            id: edge.neighborId,
            accumulatedOffset: accumulatedOffset + edge.offset,
          });
        }
      }
    }

    return null;
  };

  for (const person of dataset.people.values()) {
    if (person.privacy === 'private') {
      privateEntityIds.add(person.id);
    }

    if (person.privacy === 'living-person restricted') {
      livingPersonIds.add(person.id);
      continue;
    }

    if (hasDeathEvent(person.id)) {
      // Deceased
      continue;
    }

    const birthYear = getKnownBirthYear(person.id);
    if (birthYear !== null) {
      if (currentYear - birthYear < 100) {
        livingPersonIds.add(person.id);
      }
      continue;
    }

    // No birth date and no death date -> Generational inference
    const estimated = estimateBirthYear(person.id);
    if (estimated !== null) {
      if (currentYear - estimated < 100) {
        livingPersonIds.add(person.id);
      }
    }
  }

  // Also flag private media and sources
  for (const med of dataset.media.values()) {
    if (med.privacy === 'private') {
      privateEntityIds.add(med.id);
    }
  }

  return { livingPersonIds, privateEntityIds };
}
