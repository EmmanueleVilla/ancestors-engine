import { describe, it, expect } from 'vitest';
import { PersonSchema } from '../../src/model/person.js';
import { EventSchema } from '../../src/model/event.js';
import { RelationshipSchema } from '../../src/model/relationship.js';
import { NormalizedDataset } from '../../src/validator/index.js';
import { inferLivingAndPrivateEntities } from '../../src/privacy/inference.js';

describe('Living Person Generational Inference', () => {
  it('detects person born < 100 years ago as living', () => {
    const p1 = PersonSchema.parse({ id: 'P1', given_names: 'Recent', surname: 'Relative' });
    const evt = EventSchema.parse({
      id: 'E1',
      event_type: 'birth',
      person_ids: ['P1'],
      date: { precision: 'exact', year: 1995 },
    });

    const dataset: NormalizedDataset = {
      people: new Map([['P1', p1]]),
      families: new Map(),
      relationships: [],
      events: new Map([['E1', evt]]),
      places: new Map(),
      sources: new Map(),
      citations: new Map(),
      media: new Map(),
    };

    const res = inferLivingAndPrivateEntities(dataset, 2026);
    expect(res.livingPersonIds.has('P1')).toBe(true);
  });

  it('detects person born > 100 years ago as deceased', () => {
    const p1 = PersonSchema.parse({ id: 'P1', given_names: 'Old', surname: 'Ancestor' });
    const evt = EventSchema.parse({
      id: 'E1',
      event_type: 'birth',
      person_ids: ['P1'],
      date: { precision: 'exact', year: 1850 },
    });

    const dataset: NormalizedDataset = {
      people: new Map([['P1', p1]]),
      families: new Map(),
      relationships: [],
      events: new Map([['E1', evt]]),
      places: new Map(),
      sources: new Map(),
      citations: new Map(),
      media: new Map(),
    };

    const res = inferLivingAndPrivateEntities(dataset, 2026);
    expect(res.livingPersonIds.has('P1')).toBe(false);
  });

  it('infers living status for undated child of recent parent', () => {
    // Parent born 1970, child has NO dates.
    // Estimated child birth = 1970 + 30 = 2000 -> living!
    const parent = PersonSchema.parse({ id: 'Parent', given_names: 'John', surname: 'Doe' });
    const child = PersonSchema.parse({ id: 'Child', given_names: 'Baby', surname: 'Doe' });
    const bEvt = EventSchema.parse({
      id: 'E1',
      event_type: 'birth',
      person_ids: ['Parent'],
      date: { precision: 'exact', year: 1970 },
    });
    const rel = RelationshipSchema.parse({
      id: 'R1',
      person_id: 'Parent',
      related_person_id: 'Child',
      relationship_type: 'biological_parent',
    });

    const dataset: NormalizedDataset = {
      people: new Map([
        ['Parent', parent],
        ['Child', child],
      ]),
      families: new Map(),
      relationships: [rel],
      events: new Map([['E1', bEvt]]),
      places: new Map(),
      sources: new Map(),
      citations: new Map(),
      media: new Map(),
    };

    const res = inferLivingAndPrivateEntities(dataset, 2026);
    expect(res.livingPersonIds.has('Parent')).toBe(true);
    expect(res.livingPersonIds.has('Child')).toBe(true);
  });

  it('infers deceased status for undated parent of 1850 person', () => {
    // Child born 1850. Undated parent estimated born ~1820 -> deceased!
    const parent = PersonSchema.parse({ id: 'AncestorParent', given_names: 'Ancient', surname: 'Doe' });
    const child = PersonSchema.parse({ id: 'OldChild', given_names: 'Old', surname: 'Doe' });
    const bEvt = EventSchema.parse({
      id: 'E1',
      event_type: 'birth',
      person_ids: ['OldChild'],
      date: { precision: 'exact', year: 1850 },
    });
    const rel = RelationshipSchema.parse({
      id: 'R1',
      person_id: 'AncestorParent',
      related_person_id: 'OldChild',
      relationship_type: 'biological_parent',
    });

    const dataset: NormalizedDataset = {
      people: new Map([
        ['AncestorParent', parent],
        ['OldChild', child],
      ]),
      families: new Map(),
      relationships: [rel],
      events: new Map([['E1', bEvt]]),
      places: new Map(),
      sources: new Map(),
      citations: new Map(),
      media: new Map(),
    };

    const res = inferLivingAndPrivateEntities(dataset, 2026);
    expect(res.livingPersonIds.has('AncestorParent')).toBe(false);
    expect(res.livingPersonIds.has('OldChild')).toBe(false);
  });
});
