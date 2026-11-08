import { describe, it, expect } from 'vitest';
import { PersonSchema } from '../../src/model/person.js';
import { FamilySchema } from '../../src/model/family.js';
import { RelationshipSchema } from '../../src/model/relationship.js';
import { NormalizedDataset } from '../../src/validator/index.js';
import { renderTreeNode, buildAncestorBranch } from '../../src/generator/components/tree.js';
import { renderPersonPage } from '../../src/generator/pages/person.js';

describe('Tree and Person Components', () => {
  const p1 = PersonSchema.parse({ id: 'P1', given_names: 'John', surname: 'Doe' });
  const p2 = PersonSchema.parse({ id: 'P2', given_names: 'Jane', surname: 'Smith' });
  const p3 = PersonSchema.parse({ id: 'P3', given_names: 'Child', surname: 'Doe' });

  const dataset: NormalizedDataset = {
    people: new Map([
      ['P1', p1],
      ['P2', p2],
      ['P3', p3],
    ]),
    families: new Map([
      ['F1', FamilySchema.parse({ id: 'F1', partner_ids: ['P1', 'P2'], children_ids: ['P3'] })],
    ]),
    relationships: [
      RelationshipSchema.parse({ id: 'r1', person_id: 'P1', related_person_id: 'P3', relationship_type: 'biological_parent' }),
      RelationshipSchema.parse({ id: 'r2', person_id: 'P2', related_person_id: 'P3', relationship_type: 'biological_parent' }),
    ],
    events: new Map(),
    places: new Map(),
    sources: new Map(),
    citations: new Map(),
    media: new Map(),
  };

  it('renders tree nodes with links', () => {
    const node = renderTreeNode('P1', dataset, '../');
    expect(node).toContain('href="../people/P1.html"');
    expect(node).toContain('John Doe');
  });

  it('builds ancestor branch for child', () => {
    const branch = buildAncestorBranch('P3', dataset, 1, 4, '../');
    expect(branch).toContain('href="../people/P3.html"');
    expect(branch).toContain('href="../people/P1.html"');
    expect(branch).toContain('href="../people/P2.html"');
  });

  it('renders person profile with immediate family', () => {
    const html = renderPersonPage(p3, dataset, '../');
    expect(html).toContain('Child Doe');
    expect(html).toContain('href="../people/P1.html"');
    expect(html).toContain('href="../people/P2.html"');
  });
});
