import { describe, it, expect } from 'vitest';
import { PersonSchema } from '../../src/model/person.js';
import { FamilySchema } from '../../src/model/family.js';
import { RelationshipSchema } from '../../src/model/relationship.js';
import { NormalizedDataset } from '../../src/validator/index.js';
import { renderTreeNode, buildAncestorBranch } from '../../src/generator/components/tree.js';
import { renderPersonPage } from '../../src/generator/pages/person.js';
import { renderTreePage } from '../../src/generator/pages/tree.js';
import { renderDocument, safeJsonLd } from '../../src/generator/components/base.js';
import { renderSurnamesIndexPage } from '../../src/generator/pages/surnames.js';
import { EventSchema } from '../../src/model/event.js';

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

  it('renders tree page with full screen canvas controls and wide layout', () => {
    const html = renderTreePage(p3, dataset, '../');
    expect(html).toContain('class="scrivania scrivania-larga"');
    expect(html).toContain('class="serie-0 larga"');
    expect(html).toContain('id="tree-canvas"');
    expect(html).toContain('id="btn-fullscreen"');
  });

  it('safely escapes < characters in JSON-LD output', () => {
    const payload = {
      '@context': 'https://schema.org',
      description: 'Test <script>alert("xss")</script> & other <tags>',
    };
    const escaped = safeJsonLd(payload);
    expect(escaped).not.toContain('<script>');
    expect(escaped).not.toContain('<tags>');
    expect(escaped).toContain('\\u003cscript>');
    expect(escaped).toContain('\\u003ctags>');

    const doc = renderDocument({
      title: 'Test',
      bodyContent: '<p>Hi</p>',
      jsonLd: payload,
    });
    expect(doc).not.toContain('<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "description": "Test <script>');
    expect(doc).toContain('\\u003cscript>alert');
  });

  it('excludes living people and [Living] group from surname time span and top places', () => {
    const livingPerson = PersonSchema.parse({
      id: 'L1',
      given_names: 'Living',
      surname: 'Rossi',
      privacy: 'living-person restricted',
    });
    const livingEvt = EventSchema.parse({
      id: 'E_LIV',
      person_ids: ['L1'],
      event_type: 'birth',
      date: { year: 2005, precision: 'exact' },
      place_id: 'PLC_SECRET',
    });

    const surnDataset: NormalizedDataset = {
      ...dataset,
      people: new Map([['L1', livingPerson]]),
      events: new Map([['E_LIV', livingEvt]]),
    };

    const html = renderSurnamesIndexPage(surnDataset, '../');
    // Non deve mostrare 2005 né PLC_SECRET nella scheda del gruppo [Living]
    expect(html).toContain('[Living]');
    expect(html).not.toContain('Attestazione:');
    expect(html).not.toContain('2005');
    expect(html).not.toContain('PLC_SECRET');
  });
});
