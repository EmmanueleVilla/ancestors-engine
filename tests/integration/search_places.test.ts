import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runBuildCommand } from '../../src/cli/build.js';

describe('Search, Places, and Surnames Integration', () => {
  const testOutDir = path.resolve('tests/fixtures/test-dist-search');

  afterEach(() => {
    if (fs.existsSync(testOutDir)) fs.rmSync(testOutDir, { recursive: true, force: true });
  });

  it('renders places directory, place pages, surnames index, timeline, and search index', () => {
    const validDir = path.resolve('tests/fixtures/valid-dataset');
    const exitCode = runBuildCommand({
      dataDir: validDir,
      configPath: path.resolve('tests/fixtures/test-archive.config.yml'),
      outDir: testOutDir,
      silent: true,
    });

    expect(exitCode).toBe(0);

    // 1. Places directory
    expect(fs.existsSync(path.join(testOutDir, 'places', 'index.html'))).toBe(true);
    const placesDirHtml = fs.readFileSync(path.join(testOutDir, 'places', 'index.html'), 'utf-8');
    expect(placesDirHtml).toContain('St Mary Parish');

    // 2. Individual place page
    expect(fs.existsSync(path.join(testOutDir, 'places', 'PLC001.html'))).toBe(true);
    const placeHtml = fs.readFileSync(path.join(testOutDir, 'places', 'PLC001.html'), 'utf-8');
    expect(placeHtml).toContain('St Mary Parish');
    expect(placeHtml).toContain('Thomas Doe');

    // 3. Surnames index page
    expect(fs.existsSync(path.join(testOutDir, 'surnames', 'index.html'))).toBe(true);
    const surnamesHtml = fs.readFileSync(path.join(testOutDir, 'surnames', 'index.html'), 'utf-8');
    expect(surnamesHtml).toContain('Doe');
    expect(surnamesHtml).toContain('Smith');

    // 4. Timeline page
    expect(fs.existsSync(path.join(testOutDir, 'timeline.html'))).toBe(true);
    const timelineHtml = fs.readFileSync(path.join(testOutDir, 'timeline.html'), 'utf-8');
    expect(timelineHtml).toContain('1875');
    expect(timelineHtml).toContain('Thomas Doe');

    // 5. Search page and search index
    expect(fs.existsSync(path.join(testOutDir, 'search.html'))).toBe(true);
    expect(fs.existsSync(path.join(testOutDir, 'search-index.json'))).toBe(true);

    const indexJson = JSON.parse(fs.readFileSync(path.join(testOutDir, 'search-index.json'), 'utf-8'));
    expect(Array.isArray(indexJson)).toBe(true);
    expect(indexJson.some((r: any) => r.display_name === 'Thomas Doe')).toBe(true);
  });
});
