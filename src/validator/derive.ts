import { Family, getChildConfidence } from '../model/family.js';
import { Relationship } from '../model/relationship.js';

export function deriveRelationships(
  families: Family[],
  explicitRelationships: Relationship[] = []
): Relationship[] {
  const results: Relationship[] = [...explicitRelationships];

  // Map of existing parent-child links: "parent:child"
  const existingParentChild = new Set<string>();

  for (const rel of explicitRelationships) {
    if (
      rel.relationship_type === 'biological_parent' ||
      rel.relationship_type === 'adoptive_parent' ||
      rel.relationship_type === 'legal_parent' ||
      rel.relationship_type === 'foster_parent' ||
      rel.relationship_type === 'step_parent' ||
      rel.relationship_type === 'guardian'
    ) {
      existingParentChild.add(`${rel.person_id}:${rel.related_person_id}`);
    }
  }

  for (const family of families) {
    const partners = family.partner_ids || [];
    const children = family.children_ids || [];

    for (const partner of partners) {
      for (const child of children) {
        const key = `${partner}:${child}`;
        if (!existingParentChild.has(key)) {
          existingParentChild.add(key);
          results.push({
            id: `derived_fam_${family.id}_${partner}_${child}`,
            person_id: partner,
            related_person_id: child,
            relationship_type: 'biological_parent',
            family_id: family.id,
            ...(getChildConfidence(family, partner, child) ? { confidence: getChildConfidence(family, partner, child) as Relationship['confidence'] } : {}),
          });
        }
      }
    }
  }

  return results;
}
