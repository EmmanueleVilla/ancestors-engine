import { Relationship } from '../model/relationship.js';
import { Place } from '../model/place.js';

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

/**
 * Algoritmo generico di rilevamento cicli tramite DFS tricolore (bianco/grigio/nero)
 * su grafo diretto.
 */
export function detectGraphCycles(edges: [string, string][]): CycleDetectionResult {
  const adj = new Map<string, string[]>();
  const allNodes = new Set<string>();

  for (const [from, to] of edges) {
    allNodes.add(from);
    allNodes.add(to);

    if (!adj.has(from)) {
      adj.set(from, []);
    }
    adj.get(from)!.push(to);
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
        // Ciclo rilevato
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

export function detectKinshipCycles(relationships: Relationship[]): CycleDetectionResult {
  // Grafo orientato: Genitore (person_id) -> Figlio (related_person_id)
  const edges: [string, string][] = [];
  for (const rel of relationships) {
    if (PARENT_RELATIONSHIP_TYPES.has(rel.relationship_type)) {
      edges.push([rel.person_id, rel.related_person_id]);
    }
  }
  return detectGraphCycles(edges);
}

export function detectPlaceCycles(
  places: Map<string, { data: Place }> | Map<string, Place>
): CycleDetectionResult {
  // Grafo orientato: Luogo contenitore (parent_place_id) -> Luogo contenuto (id)
  const edges: [string, string][] = [];
  for (const [id, item] of places.entries()) {
    const plc = 'data' in item ? (item as { data: Place }).data : (item as Place);
    if (plc.parent_place_id && plc.parent_place_id !== id) {
      edges.push([plc.parent_place_id, id]);
    }
  }
  return detectGraphCycles(edges);
}
