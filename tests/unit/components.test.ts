import { describe, it, expect } from 'vitest';
import { PersonSchema } from '../../src/model/person.js';
import { FamilySchema } from '../../src/model/family.js';
import { RelationshipSchema } from '../../src/model/relationship.js';
import { NormalizedDataset } from '../../src/validator/index.js';
import { renderTreeNode, buildAncestorBranch, extractTreeGraphData, toRoman } from '../../src/generator/components/tree.js';
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

  it('converts numbers to roman numerals correctly', () => {
    expect(toRoman(1)).toBe('I');
    expect(toRoman(2)).toBe('II');
    expect(toRoman(3)).toBe('III');
    expect(toRoman(4)).toBe('IV');
    expect(toRoman(5)).toBe('V');
    expect(toRoman(9)).toBe('IX');
    expect(toRoman(10)).toBe('X');
    expect(toRoman(0)).toBe('');
  });

  it('assigns ancestorDegree to direct ancestors starting with I for grandparents', () => {
    // P4 (great-grandparent) -> P1 (grandparent) -> P3 (parent) -> P5 (focus child)
    const p4 = PersonSchema.parse({ id: 'P4', given_names: 'GreatGrandpa', surname: 'Doe' });
    const p5 = PersonSchema.parse({ id: 'P5', given_names: 'FocusChild', surname: 'Doe' });

    const multiGenDataset: NormalizedDataset = {
      ...dataset,
      people: new Map([
        ['P1', p1],
        ['P2', p2],
        ['P3', p3],
        ['P4', p4],
        ['P5', p5],
      ]),
      families: new Map([
        ['F0', FamilySchema.parse({ id: 'F0', partner_ids: ['P4'], children_ids: ['P1'] })],
        ['F1', FamilySchema.parse({ id: 'F1', partner_ids: ['P1', 'P2'], children_ids: ['P3'] })],
        ['F2', FamilySchema.parse({ id: 'F2', partner_ids: ['P3'], children_ids: ['P5'] })],
      ]),
      relationships: [
        RelationshipSchema.parse({ id: 'r0', person_id: 'P4', related_person_id: 'P1', relationship_type: 'biological_parent' }),
        RelationshipSchema.parse({ id: 'r1', person_id: 'P1', related_person_id: 'P3', relationship_type: 'biological_parent' }),
        RelationshipSchema.parse({ id: 'r2', person_id: 'P2', related_person_id: 'P3', relationship_type: 'biological_parent' }),
        RelationshipSchema.parse({ id: 'r3', person_id: 'P3', related_person_id: 'P5', relationship_type: 'biological_parent' }),
      ],
    };

    const graph = extractTreeGraphData('P5', multiGenDataset, '../');
    const nodes = new Map(graph.nodes.map((n) => [n.id, n]));

    // Focus child
    expect(nodes.get('P5')?.ancestorDegree).toBeUndefined();
    // Parent (P3): distance 1 -> no roman numeral
    expect(nodes.get('P3')?.ancestorDegree).toBeUndefined();
    // Grandparents (P1, P2): distance 2 -> I
    expect(nodes.get('P1')?.ancestorDegree).toBe('I');
    expect(nodes.get('P2')?.ancestorDegree).toBe('I');
    // Great-grandparent (P4): distance 3 -> II
    expect(nodes.get('P4')?.ancestorDegree).toBe('II');
  });
});
