import { describe, it, expect } from 'vitest';
import {
  normalizeSearchText,
  compactSearchText,
  phoneticSearchVariant,
  prepareSearchRecord,
  matchRecord,
  filterSearchIndex,
} from '../../src/generator/search/matcher.js';
import { SearchIndexRecord } from '../../src/generator/search/index.js';

describe('Search Matcher with Historical Variants', () => {
  it('normalizes diacritics, accents, and apostrophes', () => {
    expect(normalizeSearchText('Nicolò')).toBe('nicolo');
    expect(normalizeSearchText("De' Capitani")).toBe('de capitani');
    expect(normalizeSearchText('Giosuè')).toBe('giosue');
    expect(normalizeSearchText('D’Adda')).toBe('dadda');
  });

  it('compacts text removing all spaces', () => {
    expect(compactSearchText('De Capitani')).toBe('decapitani');
    expect(compactSearchText("De' Capitani")).toBe('decapitani');
    expect(compactSearchText('Dalla Torre')).toBe('dallatorre');
  });

  it('computes historical phonetic variants', () => {
    // ou -> o
    expect(phoneticSearchVariant('Courbetta')).toBe('corbeta');
    // duplicate consonants collapsed
    expect(phoneticSearchVariant('Fumagalli')).toBe('fumagali');
    expect(phoneticSearchVariant('Corbetta')).toBe('corbeta');
  });

  const sampleRecords: SearchIndexRecord[] = [
    {
      id: 'P1',
      display_name: 'Giacomo De Capitani',
      given_names: 'Giacomo',
      surname: 'De Capitani',
      birth_year: 1899,
      death_year: 1980,
      places: ['Verona', 'Padova'],
      url: 'people/P1.html',
    },
    {
      id: 'P2',
      display_name: 'Lucia Corbetta',
      given_names: 'Lucia',
      surname: 'Corbetta',
      birth_year: 1901,
      death_year: 1977,
      places: ['Milano'],
      url: 'people/P2.html',
    },
    {
      id: 'P3',
      display_name: 'Elena Fumagalli',
      given_names: 'Elena',
      surname: 'Fumagalli',
      birth_year: 1924,
      death_year: 2019,
      places: ['Bergamo'],
      url: 'people/P3.html',
    },
    {
      id: 'P4',
      display_name: 'Giosuè Testoni',
      given_names: 'Giosuè',
      surname: 'Testoni',
      birth_year: 1870,
      death_year: 1945,
      places: ['Brescia'],
      url: 'people/P4.html',
    },
  ];

  const prepared = sampleRecords.map(prepareSearchRecord);

  it('matches spaced surnames when querying attached (Decapitani -> De Capitani)', () => {
    const res = filterSearchIndex(prepared, 'decapitani');
    expect(res.map((r) => r.id)).toContain('P1');
  });

  it('matches attached query with apostrophe (de\' capitani -> De Capitani)', () => {
    const res = filterSearchIndex(prepared, "de' capitani");
    expect(res.map((r) => r.id)).toContain('P1');
  });

  it('matches historical French/Napoleonic spelling (courbetta -> Corbetta)', () => {
    const res = filterSearchIndex(prepared, 'courbetta');
    expect(res.map((r) => r.id)).toContain('P2');
  });

  it('matches single consonant variant (fumagali -> Fumagalli)', () => {
    const res = filterSearchIndex(prepared, 'fumagali');
    expect(res.map((r) => r.id)).toContain('P3');
  });

  it('matches accent-insensitive (giosue -> Giosuè)', () => {
    const res = filterSearchIndex(prepared, 'giosue');
    expect(res.map((r) => r.id)).toContain('P4');
  });

  it('supports multi-token queries combining name, year, and place', () => {
    // Name + Year
    const byYear = filterSearchIndex(prepared, 'corbetta 1901');
    expect(byYear.map((r) => r.id)).toEqual(['P2']);

    // Surname variant + Place
    const byPlace = filterSearchIndex(prepared, 'decapitani verona');
    expect(byPlace.map((r) => r.id)).toEqual(['P1']);

    // Multiple tokens matching same record
    const byMulti = filterSearchIndex(prepared, 'lucia milano 1901');
    expect(byMulti.map((r) => r.id)).toEqual(['P2']);
  });

  it('returns empty array when query does not match or is whitespace', () => {
    expect(filterSearchIndex(prepared, 'sconosciuto')).toHaveLength(0);
    expect(filterSearchIndex(prepared, '   ')).toHaveLength(0);
    expect(filterSearchIndex(prepared, '')).toHaveLength(0);
  });
});
