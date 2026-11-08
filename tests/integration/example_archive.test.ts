import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { runBuildCommand } from '../../src/cli/build.js';
import { runValidateCommand } from '../../src/cli/validate.js';

// L'archivio di esempio (famiglia inventata) deve restare valido e generare un sito pubblico senza fughe.
describe('Example archive', () => {
  const exampleDir = path.resolve('example');
  const outDir = path.resolve('tests/fixtures/test-dist-example');

  afterEach(() => {
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('validates in strict mode', () => {
    expect(runValidateCommand({ dataDir: path.join(exampleDir, 'data'), strict: true, silent: true })).toBe(0);
  });

  it('builds a public site where living people have no name and no original ID', () => {
    const exitCode = runBuildCommand({
      dataDir: path.join(exampleDir, 'data'),
      configPath: path.join(exampleDir, 'archivio.config.yml'),
      outDir,
      profile: 'public',
      silent: true,
    });
    expect(exitCode).toBe(0);
    const people = fs.readdirSync(path.join(outDir, 'people'));
    expect(people.some((f) => f.startsWith('P001'))).toBe(false);
    expect(people.filter((f) => f.startsWith('L-')).length).toBe(4);
    expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8')).toContain('Archivio della famiglia Rossi');
    expect(fs.existsSync(path.join(outDir, 'next-steps.html'))).toBe(false);
    // Dataset scaricabile, con lo stesso filtro delle pagine
    expect(fs.readFileSync(path.join(outDir, 'index.html'), 'utf-8')).toContain('href="./dati.html"');
    expect(fs.existsSync(path.join(outDir, 'dati.html'))).toBe(true);
    const data = JSON.parse(fs.readFileSync(path.join(outDir, 'dati', 'people.json'), 'utf-8')) as { id: string; surname: string }[];
    expect(data.some((p) => p.id === 'P001_rossi_luca')).toBe(false);
    expect(data.filter((p) => p.surname === '[Living]').length).toBe(4);
  });

  it('builds a private site with everyone and the next steps page', () => {
    const exitCode = runBuildCommand({
      dataDir: path.join(exampleDir, 'data'),
      configPath: path.join(exampleDir, 'archivio.config.yml'),
      outDir,
      profile: 'private',
      silent: true,
    });
    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(outDir, 'people', 'P001_rossi_luca.html'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'next-steps.html'))).toBe(true);
    expect(fs.existsSync(path.join(outDir, 'dati.html'))).toBe(false);
    expect(fs.existsSync(path.join(outDir, 'dati'))).toBe(false);
  });
});

describe('Public export', () => {
  const outDir = path.resolve('tests/fixtures/test-export-example');
  afterEach(() => fs.rmSync(outDir, { recursive: true, force: true }));

  it('exports the public dataset as JSON without living people names or IDs', async () => {
    const { runExportCommand } = await import('../../src/cli/export.js');
    const exitCode = runExportCommand({
      dataDir: path.resolve('example/data'),
      configPath: path.resolve('example/archivio.config.yml'),
      outDir,
      silent: true,
    });
    expect(exitCode).toBe(0);
    const people = JSON.parse(fs.readFileSync(path.join(outDir, 'people.json'), 'utf-8')) as { id: string; surname: string }[];
    expect(people.length).toBe(10);
    expect(people.some((p) => p.id === 'P001_rossi_luca')).toBe(false);
    expect(people.filter((p) => p.surname === '[Living]').length).toBe(4);
  });
});
