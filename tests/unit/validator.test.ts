import { describe, it, expect } from 'vitest';
import { PersonSchema } from '../../src/model/person.js';
import { FamilySchema } from '../../src/model/family.js';
import { RelationshipSchema } from '../../src/model/relationship.js';
import { PlaceSchema, Place } from '../../src/model/place.js';
import { DateValueSchema, formatDate, getDateSortKey } from '../../src/model/date.js';
import { detectKinshipCycles, detectPlaceCycles } from '../../src/validator/cycle.js';
import { deriveRelationships } from '../../src/validator/derive.js';
import { validateReferences, DatasetIndex } from '../../src/validator/reference.js';

describe('Date & Formatting', () => {
  it('formats exact dates and computes sort keys', () => {
    const d = DateValueSchema.parse({
      precision: 'exact',
      year: 1910,
      month: 5,
      day: 12,
    });
    expect(formatDate(d)).toBe('12 May 1910');
    expect(getDateSortKey(d)).toBe('1910-05-12');
  });

  it('formats approximate and range dates', () => {
    const approx = DateValueSchema.parse({
      precision: 'approximate',
      year: 1845,
    });
    expect(formatDate(approx)).toBe('abt. 1845');

    const range = DateValueSchema.parse({
      precision: 'range',
      year: 1780,
      end_year: 1785,
    });
    expect(formatDate(range)).toBe('between 1780 and 1785');
  });
});

describe('Cycle Detection (DFS 3-color)', () => {
  it('detects simple parent-child cycles', () => {
    const rels = [
      RelationshipSchema.parse({
        id: 'r1',
        person_id: 'P001',
        related_person_id: 'P002',
        relationship_type: 'biological_parent',
      }),
      RelationshipSchema.parse({
        id: 'r2',
        person_id: 'P002',
        related_person_id: 'P001',
        relationship_type: 'biological_parent',
      }),
    ];
    const res = detectKinshipCycles(rels);
    expect(res.hasCycle).toBe(true);
    expect(res.cycles[0]).toContain('P001 -> P002 -> P001');
  });

  it('detects indirect 3-generation cycles', () => {
    const rels = [
      RelationshipSchema.parse({
        id: 'r1',
        person_id: 'A',
        related_person_id: 'B',
        relationship_type: 'biological_parent',
      }),
      RelationshipSchema.parse({
        id: 'r2',
        person_id: 'B',
        related_person_id: 'C',
        relationship_type: 'biological_parent',
      }),
      RelationshipSchema.parse({
        id: 'r3',
        person_id: 'C',
        related_person_id: 'A',
        relationship_type: 'biological_parent',
      }),
    ];
    const res = detectKinshipCycles(rels);
    expect(res.hasCycle).toBe(true);
    expect(res.cycles[0]).toContain('A -> B -> C -> A');
  });

  it('passes on valid acyclic trees', () => {
    const rels = [
      RelationshipSchema.parse({
        id: 'r1',
        person_id: 'Grandparent',
        related_person_id: 'Parent',
        relationship_type: 'biological_parent',
      }),
      RelationshipSchema.parse({
        id: 'r2',
        person_id: 'Parent',
        related_person_id: 'Child',
        relationship_type: 'biological_parent',
      }),
    ];
    const res = detectKinshipCycles(rels);
    expect(res.hasCycle).toBe(false);
    expect(res.cycles).toHaveLength(0);
  });

  it('detectPlaceCycles detects self-loop and multi-hop cycles', () => {
    // Self-loop: PLC1 parent of itself
    const selfLoopMap = new Map<string, { data: Place }>([
      ['PLC1', { data: PlaceSchema.parse({ id: 'PLC1', name: 'Luogo', place_type: 'town', parent_place_id: 'PLC1' }) }],
    ]);
    const resSelf = detectPlaceCycles(selfLoopMap);
    expect(resSelf.hasCycle).toBe(true);
    expect(resSelf.cycles[0]).toContain('PLC1 -> PLC1');

    // Multi-hop cycle: PLC1 in PLC2, PLC2 in PLC1
    const multiHopMap = new Map<string, { data: Place }>([
      ['PLC1', { data: PlaceSchema.parse({ id: 'PLC1', name: 'L1', place_type: 'town', parent_place_id: 'PLC2' }) }],
      ['PLC2', { data: PlaceSchema.parse({ id: 'PLC2', name: 'L2', place_type: 'town', parent_place_id: 'PLC1' }) }],
    ]);
    const resMulti = detectPlaceCycles(multiHopMap);
    expect(resMulti.hasCycle).toBe(true);
    expect(resMulti.cycles[0]).toMatch(/PLC[12] -> PLC[12] -> PLC[12]/);

    // Acyclic
    const acyclicMap = new Map<string, { data: Place }>([
      ['PLC1', { data: PlaceSchema.parse({ id: 'PLC1', name: 'L1', place_type: 'town' }) }],
      ['PLC2', { data: PlaceSchema.parse({ id: 'PLC2', name: 'L2', place_type: 'town', parent_place_id: 'PLC1' }) }],
    ]);
    const resAcyclic = detectPlaceCycles(acyclicMap);
    expect(resAcyclic.hasCycle).toBe(false);
  });
});

describe('Relationship Derivation from Family', () => {
  it('automatically derives biological parent-child links', () => {
    const family = FamilySchema.parse({
      id: 'FAM001',
      partner_ids: ['Father', 'Mother'],
      children_ids: ['Child1', 'Child2'],
    });

    const derived = deriveRelationships([family], []);
    expect(derived).toHaveLength(4);
    const pairs = derived.map((r) => `${r.person_id}->${r.related_person_id}`);
    expect(pairs).toContain('Father->Child1');
    expect(pairs).toContain('Father->Child2');
    expect(pairs).toContain('Mother->Child1');
    expect(pairs).toContain('Mother->Child2');
  });

  it('does not duplicate explicit relationships', () => {
    const family = FamilySchema.parse({
      id: 'FAM001',
      partner_ids: ['AdoptiveParent'],
      children_ids: ['Child'],
    });
    const explicit = [
      RelationshipSchema.parse({
        id: 'rel_adopt',
        person_id: 'AdoptiveParent',
        related_person_id: 'Child',
        relationship_type: 'adoptive_parent',
      }),
    ];

    const derived = deriveRelationships([family], explicit);
    expect(derived).toHaveLength(1);
    expect(derived[0].relationship_type).toBe('adoptive_parent');
  });
});

describe('Referential Integrity', () => {
  it('detects dangling references and self-references', () => {
    const index: DatasetIndex = {
      people: new Map([
        [
          'P001',
          {
            data: PersonSchema.parse({
              id: 'P001',
              given_names: 'John',
              surname: 'Doe',
              birth_event_id: 'MISSING_EVT',
            }),
            filePath: 'data/people/P001.yml',
          },
        ],
      ]),
      families: new Map(),
      relationships: new Map([
        [
          'R1',
          {
            data: RelationshipSchema.parse({
              id: 'R1',
              person_id: 'P001',
              related_person_id: 'P001',
              relationship_type: 'spouse',
            }),
            filePath: 'data/relationships/R1.yml',
          },
        ],
      ]),
      events: new Map(),
      places: new Map(),
      sources: new Map(),
      citations: new Map(),
      media: new Map(),
    };

    const errors = validateReferences(index);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.message.includes('MISSING_EVT'))).toBe(true);
    expect(errors.some((e) => e.message.includes('Self-reference'))).toBe(true);
  });

  it('citazione con family_id discordante rispetto a event_id genera errore', () => {
    const index: DatasetIndex = {
      people: new Map(),
      families: new Map([
        ['FAM1', { data: FamilySchema.parse({ id: 'FAM1', partner_ids: [] }), filePath: 'data/families/FAM1.yml' }],
        ['FAM2', { data: FamilySchema.parse({ id: 'FAM2', partner_ids: [] }), filePath: 'data/families/FAM2.yml' }],
      ]),
      events: new Map([
        ['EVT1', { data: { id: 'EVT1', event_type: 'marriage', family_id: 'FAM2' } as any, filePath: 'data/events/EVT1.yml' }],
      ]),
      relationships: new Map(),
      places: new Map(),
      sources: new Map([['SRC1', { data: { id: 'SRC1', title: 'Fonte' } as any, filePath: 'data/sources/SRC1.yml' }]]),
      citations: new Map([
        ['C1', { data: { id: 'C1', source_id: 'SRC1', claim_type: 'marriage', family_id: 'FAM1', event_id: 'EVT1' } as any, filePath: 'data/citations/C1.yml' }],
      ]),
      media: new Map(),
    };
    const errors = validateReferences(index);
    expect(errors.some((e) => e.message.includes("appartiene alla famiglia 'FAM2'"))).toBe(true);
  });
});
