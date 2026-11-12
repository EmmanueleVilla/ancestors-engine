/**
 * Genitori e antenati diretti, calcolati come li mostra il sito.
 * Lo usano l'albero (segnaposto "?") e il validatore (controlli su `parents_next_step`),
 * così le due parti non possono divergere.
 */

/** Il minimo di una famiglia che serve qui. */
export interface LineageFamily {
  partner_ids?: string[];
  children_ids?: string[];
}

/** Il minimo di una relazione che serve qui. */
export interface LineageRelationship {
  person_id: string;
  related_person_id: string;
  relationship_type: string;
}

/** Vero se la relazione lega un genitore (`person_id`) a un figlio (`related_person_id`). */
export const isParentRelationship = (rel: LineageRelationship): boolean => rel.relationship_type.endsWith('_parent');

/** Genitori di ogni persona: partner delle famiglie in cui compare come figlio e relazioni `*_parent`. */
export function buildParentsOf(
  families: Iterable<LineageFamily>,
  relationships: Iterable<LineageRelationship>
): Map<string, Set<string>> {
  const parentsOf = new Map<string, Set<string>>();
  const add = (childId: string, parentId: string) => {
    const set = parentsOf.get(childId) || new Set<string>();
    set.add(parentId);
    parentsOf.set(childId, set);
  };
  for (const fam of families) {
    for (const childId of fam.children_ids || []) {
      for (const pid of fam.partner_ids || []) add(childId, pid);
    }
  }
  for (const rel of relationships) {
    if (isParentRelationship(rel)) add(rel.related_person_id, rel.person_id);
  }
  return parentsOf;
}

/**
 * Antenati diretti della radice, nell'ordine di visita: i suoi genitori e quelli del coniuge
 * con cui ha figli, risalendo. La radice è esclusa (l'albero non le mette il segnaposto "?").
 */
export function directAncestorsOf(
  rootId: string,
  families: Iterable<LineageFamily>,
  parentsOf: Map<string, Set<string>>
): string[] {
  const coParents = new Set<string>();
  for (const fam of families) {
    if (!(fam.partner_ids || []).includes(rootId) || (fam.children_ids || []).length === 0) continue;
    for (const pid of fam.partner_ids || []) if (pid !== rootId) coParents.add(pid);
  }

  const ancestors: string[] = [];
  const seen = new Set<string>([rootId]);
  const queue = [...(parentsOf.get(rootId) || []), ...coParents];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ancestors.push(id);
    queue.push(...(parentsOf.get(id) || []));
  }
  return ancestors;
}

export type MissingParents = 'both' | 'father' | 'mother';

/** Quale genitore manca per l'albero (padre `male`, madre `female`); `null` se ci sono entrambi. */
export function missingParents(parentSexes: Iterable<string | undefined>): MissingParents | null {
  const sexes = [...parentSexes];
  const hasFather = sexes.includes('male');
  const hasMother = sexes.includes('female');
  if (hasFather && hasMother) return null;
  return !hasFather && !hasMother ? 'both' : hasFather ? 'mother' : 'father';
}
