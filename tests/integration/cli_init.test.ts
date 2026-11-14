import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'yaml';
import { runInitCommand } from '../../src/cli/init.js';

describe('CLI Init Command', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('scaffolds a complete archive repository with custom name and random pseudonym key', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ancestors-init-test-'));

    const exitCode = runInitCommand({
      targetDir: tempDir,
      name: 'Rossi',
    });

    expect(exitCode).toBe(0);

    // Cartelle richieste
    const expectedDirs = [
      'data/people',
      'data/families',
      'data/events',
      'data/places',
      'data/sources',
      'data/citations',
      'data/media',
      'data/relationships',
      'data/research',
      'assets',
      'scansioni_da_leggere',
      '.githooks',
    ];
    for (const dir of expectedDirs) {
      expect(fs.existsSync(path.join(tempDir, dir))).toBe(true);
    }

    // File richiesti
    const expectedFiles = [
      'archivio.config.yml',
      'data/research/registro_ricerche.yml',
      'NEXT_STEPS.md',
      '.gitignore',
      'CLAUDE.md',
      'AGENTS.md',
      '.githooks/pre-commit',
      'package.json',
    ];
    for (const file of expectedFiles) {
      expect(fs.existsSync(path.join(tempDir, file))).toBe(true);
    }

    // Contenuto personalizzato
    const configContent = fs.readFileSync(path.join(tempDir, 'archivio.config.yml'), 'utf-8');
    expect(configContent).toContain('title: "Archivio Rossi"');
    expect(configContent).not.toContain('"CAMBIAMI"');
    expect(configContent).toMatch(/pseudonym_key: "[a-f0-9]{32}"/);

    const pkgContent = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    expect(pkg.name).toBe('archivio-rossi');
    expect(pkg.dependencies['ancestors-engine']).toBe('github:EmmanueleVilla/ancestors-engine#v1.4.1');

    const claudeContent = fs.readFileSync(path.join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeContent).toContain('Archivio Rossi');

    const researchLogContent = fs.readFileSync(path.join(tempDir, 'data/research/registro_ricerche.yml'), 'utf-8');
    expect(researchLogContent).toContain('searches: []');

    // Skill symlink o cartella
    const skillPath = path.join(tempDir, '.agents/skills/genealogy-crud-wizard');
    const skillStat = fs.lstatSync(skillPath);
    expect(skillStat.isSymbolicLink() || skillStat.isDirectory()).toBe(true);
    if (skillStat.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(skillPath);
      expect(linkTarget).toContain('node_modules/ancestors-engine/.agents/skills/genealogy-crud-wizard');
    }
  });

  it('generates fallback package.json pointing to v1.4.1 when templates are missing', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ancestors-init-fallback-'));
    const emptyTemplatesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'empty-templates-'));

    try {
      const exitCode = runInitCommand({
        targetDir: tempDir,
        name: 'Bianchi',
        templatesDir: emptyTemplatesDir,
      });

      expect(exitCode).toBe(0);

      const pkgContent = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgContent);
      expect(pkg.name).toBe('archivio-bianchi');
      expect(pkg.dependencies['ancestors-engine']).toBe('github:EmmanueleVilla/ancestors-engine#v1.4.1');
    } finally {
      fs.rmSync(emptyTemplatesDir, { recursive: true, force: true });
    }
  });

  it('handles names with colons, hashes and accented letters properly in YAML and package.json', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ancestors-init-special-'));

    const exitCode = runInitCommand({
      targetDir: tempDir,
      name: 'Nicolò: Ramo #1',
    });

    expect(exitCode).toBe(0);

    // Il file YAML deve essere parsabile senza errori e preservare il nome esatto
    const configContent = fs.readFileSync(path.join(tempDir, 'archivio.config.yml'), 'utf-8');
    const parsed = yaml.parse(configContent);
    expect(parsed.site.title).toBe('Archivio Nicolò: Ramo #1');
    expect(parsed.site.description).toBe('Archivio genealogico della famiglia Nicolò: Ramo #1');
    expect(parsed.site.home_title).toBe('Archivio della famiglia Nicolò: Ramo #1');

    // Il nome del pacchetto in package.json non deve perdere le lettere accentate
    const pkgContent = fs.readFileSync(path.join(tempDir, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    expect(pkg.name).toBe('archivio-nicolo-ramo-1');
  });
});
