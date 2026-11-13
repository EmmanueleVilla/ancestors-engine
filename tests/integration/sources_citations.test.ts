import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runBuildCommand } from '../../src/cli/build.js';

describe('Sources & Citations Integration', () => {
  const testOutDir = path.resolve('tests/fixtures/test-dist-sources');

  afterEach(() => {
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  it('renders source catalogue, individual source page, and citation on person profile', () => {
    const validDir = path.resolve('tests/fixtures/valid-dataset');
    const exitCode = runBuildCommand({
      dataDir: validDir,
      configPath: path.resolve('tests/fixtures/test-archive.config.yml'),
      outDir: testOutDir,
      silent: true,
    });

    expect(exitCode).toBe(0);

    // 1. Source catalogue
    expect(fs.existsSync(path.join(testOutDir, 'sources', 'index.html'))).toBe(true);
    const catHtml = fs.readFileSync(path.join(testOutDir, 'sources', 'index.html'), 'utf-8');
    expect(catHtml).toContain('Parish Register of St Mary Warwick');

    // 2. Individual source
    expect(fs.existsSync(path.join(testOutDir, 'sources', 'SRC001.html'))).toBe(true);
    const srcHtml = fs.readFileSync(path.join(testOutDir, 'sources', 'SRC001.html'), 'utf-8');
    expect(srcHtml).toContain('Warwick County Record Office');
    expect(srcHtml).toContain('DR 45/1');
    expect(srcHtml).toContain('Thomas baptized 15 April 1875');
    // personLink includes punto-serie swatch and link to person
    expect(srcHtml).toContain('punto-serie');
    expect(srcHtml).toContain('href="../people/P003.html"');

    // 3. Person profile shows citation card
    const personHtml = fs.readFileSync(path.join(testOutDir, 'people', 'P003.html'), 'utf-8');
    expect(personHtml).toMatch(/href="\.\.\/sources\/SRC001\.html(#cit-CIT001)?"/);
    expect(personHtml).toContain('folio 12');
    expect(personHtml).toContain('Thomas son of William and Mary Doe');
  });
});
