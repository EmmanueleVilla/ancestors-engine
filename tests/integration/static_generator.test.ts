import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runBuildCommand } from '../../src/cli/build.js';

describe('Static Site Generator Integration', () => {
  const testOutDir = path.resolve('tests/fixtures/test-dist');

  afterEach(() => {
    if (fs.existsSync(testOutDir)) {
      fs.rmSync(testOutDir, { recursive: true, force: true });
    }
  });

  it('builds complete multi-page static site with relative links', () => {
    const validDir = path.resolve('tests/fixtures/valid-dataset');
    const exitCode = runBuildCommand({
      dataDir: validDir,
      configPath: path.resolve('tests/fixtures/test-archive.config.yml'),
      outDir: testOutDir,
      silent: true,
    });

    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(testOutDir, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(testOutDir, 'people', 'P001.html'))).toBe(true);
    expect(fs.existsSync(path.join(testOutDir, 'people', 'P003.html'))).toBe(true);
    expect(fs.existsSync(path.join(testOutDir, 'families', 'FAM001.html'))).toBe(true);
    expect(fs.existsSync(path.join(testOutDir, 'trees', 'P003.html'))).toBe(true);
    expect(fs.existsSync(path.join(testOutDir, 'assets', 'css', 'main.css'))).toBe(true);

    const indexHtml = fs.readFileSync(path.join(testOutDir, 'index.html'), 'utf-8');
    expect(indexHtml).toContain('Archivio della famiglia Rossi');
    expect(indexHtml).toContain('href="./surnames/index.html"');

    const personHtml = fs.readFileSync(path.join(testOutDir, 'people', 'P003.html'), 'utf-8');
    expect(personHtml).toContain('Thomas Doe');
    expect(personHtml).toContain('href="../people/P001.html"');
    expect(personHtml).toContain('href="../trees/P003.html"');
  });
});
