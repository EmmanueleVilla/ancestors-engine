import { Relationship } from '../model/relationship.js';

export const PARENT_RELATIONSHIP_TYPES = new Set([
  'biological_parent',
  'adoptive_parent',
  'legal_parent',
  'foster_parent',
  'step_parent',
  'guardian',
]);

export interface CycleDetectionResult {
  hasCycle: boolean;
  cycles: string[];
}

export function detectKinshipCycles(relationships: Relationship[]): CycleDetectionResult {
  // Directed graph: Parent (person_id) -> Child (related_person_id)
  const adj = new Map<string, string[]>();
  const allNodes = new Set<string>();

  for (const rel of relationships) {
    if (PARENT_RELATIONSHIP_TYPES.has(rel.relationship_type)) {
      const parent = rel.person_id;
      const child = rel.related_person_id;
      allNodes.add(parent);
      allNodes.add(child);

      if (!adj.has(parent)) {
        adj.set(parent, []);
      }
      adj.get(parent)!.push(child);
    }
  }

  // 0: White (unvisited), 1: Gray (visiting), 2: Black (visited)
  const state = new Map<string, number>();
  const cycles: string[] = [];

  for (const node of allNodes) {
    state.set(node, 0);
  }

  const stack: string[] = [];

  function dfs(u: string) {
    state.set(u, 1);
    stack.push(u);

    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      const vState = state.get(v) || 0;
      if (vState === 1) {
        // Cycle detected
        const idx = stack.indexOf(v);
        const cyclePath = [...stack.slice(idx), v].join(' -> ');
        cycles.push(cyclePath);
      } else if (vState === 0) {
        dfs(v);
      }
    }

    stack.pop();
    state.set(u, 2);
  }

  for (const node of allNodes) {
    if (state.get(node) === 0) {
      dfs(node);
    }
  }

  return {
    hasCycle: cycles.length > 0,
    cycles,
  };
}
