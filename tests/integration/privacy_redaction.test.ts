import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runBuildCommand } from '../../src/cli/build.js';
import { pseudonymFor, applyPublicProfile } from '../../src/privacy/filter.js';
import { PersonSchema } from '../../src/model/person.js';
import { MediaSchema } from '../../src/model/media.js';
import { SourceSchema } from '../../src/model/source.js';
import { SourceCitationSchema } from '../../src/model/citation.js';
import { EventSchema } from '../../src/model/event.js';
import { NormalizedDataset } from '../../src/validator/index.js';

// Nessun file di configurazione: valori predefiniti (chiave vuota, nessun vivo nominato).
const noConfig = path.resolve('tests/fixtures/mixed-dataset/__nessuna_config__.yml');

describe('Privacy Redaction Integration', () => {
  const publicOutDir = path.resolve('tests/fixtures/test-dist-public');
  const privateOutDir = path.resolve('tests/fixtures/test-dist-private');

  afterEach(() => {
    if (fs.existsSync(publicOutDir)) fs.rmSync(publicOutDir, { recursive: true, force: true });
    if (fs.existsSync(privateOutDir)) fs.rmSync(privateOutDir, { recursive: true, force: true });
  });

  it('redacts living person names and details in public profile build', () => {
    const mixedDir = path.resolve('tests/fixtures/mixed-dataset');
    const exitCode = runBuildCommand({
      dataDir: mixedDir,
      outDir: publicOutDir,
      configPath: noConfig,
      profile: 'public',
      silent: true,
    });

    expect(exitCode).toBe(0);

    // The living person's original ID never appears: file names, links and JSON use a pseudonym
    const pseudo = pseudonymFor('L001', '');
    expect(fs.existsSync(path.join(publicOutDir, 'people', 'L001.html'))).toBe(false);
    expect(fs.readFileSync(path.join(publicOutDir, 'search-index.json'), 'utf-8')).not.toContain('"L001"');

    // Living person page has [Living] and NO sensitive biography
    const livingHtml = fs.readFileSync(path.join(publicOutDir, 'people', `${pseudo}.html`), 'utf-8');
    expect(livingHtml).toContain('[Living]');
    expect(livingHtml).not.toContain('Living Cousin');
    expect(livingHtml).not.toContain('Sensitive private story');

    // Deceased ancestor page has full name and biography
    const deceasedHtml = fs.readFileSync(path.join(publicOutDir, 'people', 'D001.html'), 'utf-8');
    expect(deceasedHtml).toContain('Deceased Ancestor');
    expect(deceasedHtml).toContain('Historic biography of ancestor');
    // Linked child in family is masked as [Living]
    expect(deceasedHtml).toContain('[Living]');

    // In tree view, living person is masked
    const treeHtml = fs.readFileSync(path.join(publicOutDir, 'trees', 'D001.html'), 'utf-8');
    expect(treeHtml).toContain('[Living]');
    expect(treeHtml).not.toContain('Living Cousin');
  });

  it('preserves full names and details in private profile build', () => {
    const mixedDir = path.resolve('tests/fixtures/mixed-dataset');
    const exitCode = runBuildCommand({
      dataDir: mixedDir,
      outDir: privateOutDir,
      configPath: noConfig,
      profile: 'private',
      silent: true,
    });

    expect(exitCode).toBe(0);

    const livingHtml = fs.readFileSync(path.join(privateOutDir, 'people', 'L001.html'), 'utf-8');
    expect(livingHtml).toContain('Living Cousin');
    expect(livingHtml).toContain('Sensitive private story');
  });

  it('keeps the name and ID of a named living person, but not the details', () => {
    const mixedDir = path.resolve('tests/fixtures/mixed-dataset');
    const configPath = path.resolve('tests/fixtures/test-config-named.yml');
    fs.writeFileSync(configPath, 'privacy:\n  named_living_ids: [L001]\n', 'utf-8');
    try {
      const exitCode = runBuildCommand({ dataDir: mixedDir, outDir: publicOutDir, configPath, profile: 'public', silent: true });
      expect(exitCode).toBe(0);
      const html = fs.readFileSync(path.join(publicOutDir, 'people', 'L001.html'), 'utf-8');
      expect(html).toContain('Living Cousin');
      expect(html).not.toContain('Sensitive private story');
    } finally {
      fs.rmSync(configPath, { force: true });
    }
  });

  it('fails the public build when a living person name leaks through free text', () => {
    const srcDir = path.resolve('tests/fixtures/mixed-dataset');
    const leakDir = path.resolve('tests/fixtures/test-mixed-leak');
    fs.cpSync(srcDir, leakDir, { recursive: true });
    try {
      // The deceased ancestor's biography names the living cousin
      const d001 = path.join(leakDir, 'people', 'D001.yml');
      const original = fs.readFileSync(d001, 'utf-8');
      expect(original).toContain('Historic biography of ancestor');
      fs.writeFileSync(d001, original.replace('Historic biography of ancestor', 'Historic biography of ancestor, grandfather of Living Cousin'), 'utf-8');
      const exitCode = runBuildCommand({ dataDir: leakDir, outDir: publicOutDir, configPath: noConfig, profile: 'public', silent: true });
      expect(exitCode).toBe(3);
    } finally {
      fs.rmSync(leakDir, { recursive: true, force: true });
    }
  });

  it('excludes document scan of living person even if person_ids is omitted', () => {
    const living = PersonSchema.parse({
      id: 'L002',
      given_names: 'Mario',
      surname: 'Rossi',
      privacy: 'living-person restricted',
    });
    const birthEvt = EventSchema.parse({
      id: 'E_BIRTH_L002',
      event_type: 'birth',
      person_ids: ['L002'],
      date: { year: 1985, precision: 'exact' },
    });
    const source = SourceSchema.parse({
      id: 'SRC_ACT',
      title: 'Atto di nascita recente',
      source_type: 'civil_registry',
    });
    const citation = SourceCitationSchema.parse({
      id: 'CIT_ACT',
      source_id: 'SRC_ACT',
      person_id: 'L002',
      event_id: 'E_BIRTH_L002',
      claim_type: 'birth_record',
    });
    // Media senza person_ids ma legato alla fonte SRC_ACT
    const scanMedia = MediaSchema.parse({
      id: 'MED_ACT',
      file_path: 'scans/atto_1985.jpg',
      media_type: 'document_scan',
      source_id: 'SRC_ACT',
    });

    const dataset: NormalizedDataset = {
      people: new Map([['L002', living]]),
      families: new Map(),
      relationships: [],
      events: new Map([['E_BIRTH_L002', birthEvt]]),
      places: new Map(),
      sources: new Map([['SRC_ACT', source]]),
      citations: new Map([['CIT_ACT', citation]]),
      media: new Map([['MED_ACT', scanMedia]]),
    };

    const publicRes = applyPublicProfile(dataset);
    expect(publicRes.dataset.media.has('MED_ACT')).toBe(false);
  });
});
