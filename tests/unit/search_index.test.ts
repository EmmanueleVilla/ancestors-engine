import { describe, it, expect } from 'vitest';
import { PersonSchema } from '../../src/model/person.js';
import { NormalizedDataset } from '../../src/validator/index.js';
import { compileSearchIndex } from '../../src/generator/search/index.js';

describe('Search Index Compiler', () => {
  it('compiles search records with living person masking', () => {
    const p1 = PersonSchema.parse({
      id: 'P1',
      given_names: 'William',
      surname: 'Doe',
      maiden_name: 'Smith',
      alternative_names: ['Bill Doe'],
    });

    const pLiving = PersonSchema.parse({
      id: 'P2',
      given_names: '',
      surname: '[Living]',
      privacy: 'living-person restricted',
    });

    const dataset: NormalizedDataset = {
      people: new Map([
        ['P1', p1],
        ['P2', pLiving],
      ]),
      families: new Map(),
      relationships: [],
      events: new Map(),
      places: new Map(),
      sources: new Map(),
      citations: new Map(),
      media: new Map(),
    };

    const index = compileSearchIndex(dataset);
    expect(index).toHaveLength(2);

    const rec1 = index.find((r) => r.id === 'P1')!;
    expect(rec1.display_name).toBe('William Doe');
    expect(rec1.maiden_name).toBe('Smith');
    expect(rec1.alternative_names).toContain('Bill Doe');
    expect(rec1.url).toBe('people/P1.html');

    const rec2 = index.find((r) => r.id === 'P2')!;
    expect(rec2.display_name).toBe('[Living]');
    expect(rec2.given_names).toBe('');
    expect(rec2.surname).toBe('[Living]');
    expect(rec2.birth_year).toBeNull();
  });
});
