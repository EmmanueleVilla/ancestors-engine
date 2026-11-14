import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export interface InitOptions {
  targetDir?: string;
  name?: string;
  force?: boolean;
  templatesDir?: string;
}

const REQUIRED_DATA_DIRS = [
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

export function runInitCommand(options: InitOptions = {}): number {
  const targetDir = path.resolve(options.targetDir || process.cwd());
  const archiveName = options.name?.trim() || 'Famiglia';
  const force = !!options.force;

  console.log(`\nInizializzazione nuovo archivio genealogico in: ${targetDir}\n`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 1. Crea le directory della struttura dati
  for (const dir of REQUIRED_DATA_DIRS) {
    const fullDir = path.join(targetDir, dir);
    if (!fs.existsSync(fullDir)) {
      fs.mkdirSync(fullDir, { recursive: true });
      console.log(`  ✓ Creata cartella: ${dir}/`);
    } else {
      console.log(`  · Cartella già presente: ${dir}/`);
    }
  }

  // 2. Trova la cartella templates/
  const templatesDir = options.templatesDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates');

  const writeFileSafe = (relPath: string, content: string, mode?: number) => {
    const fullPath = path.join(targetDir, relPath);
    if (fs.existsSync(fullPath) && !force) {
      console.log(`  · File già presente (non sovrascritto): ${relPath}`);
      return;
    }
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
    if (mode !== undefined) {
      try {
        fs.chmodSync(fullPath, mode);
      } catch {
        // Ignora su sistemi che non supportano chmod
      }
    }
    console.log(`  ✓ Creato file: ${relPath}`);
  };

  // 3. archivio.config.yml con pseudonym_key generata casualmente
  const randomKey = crypto.randomBytes(16).toString('hex');
  const safeArchiveName = archiveName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  let configContent = '';
  const templateConfigPath = path.join(templatesDir, 'archivio.config.yml');
  if (fs.existsSync(templateConfigPath)) {
    configContent = fs.readFileSync(templateConfigPath, 'utf-8');
    configContent = configContent.replace(/<Cognome>/g, safeArchiveName);
    configContent = configContent.replace(/"CAMBIAMI"/g, `"${randomKey}"`);
  } else {
    configContent = `# Configurazione dell'archivio. Tienila solo nel repository privato.
site:
  title: ${JSON.stringify(`Archivio ${archiveName}`)}
  subtitle: "Fondo di famiglia"
  description: ${JSON.stringify(`Archivio genealogico della famiglia ${archiveName}`)}
  footer: "Archivio di famiglia · ogni dato rimanda alla sua fonte"
  home_title: ${JSON.stringify(`Archivio della famiglia ${archiveName}`)}
  home_intro: "Ogni persona è un fascicolo, ogni dato rimanda all'atto che lo prova."
next_steps_file: NEXT_STEPS.md
privacy:
  named_living_ids: []
  pseudonym_key: "${randomKey}"
tree:
  root_id: P001_cognome_nome
  positions: {}
`;
  }
  writeFileSafe('archivio.config.yml', configContent);

  // 4. data/research/registro_ricerche.yml
  const researchLogContent = `# Registro delle ricerche. Traccia ogni tentativo di ricerca, compresi gli esiti negativi.
# Documentazione: _docs/registro-ricerche.md
searches: []
`;
  writeFileSafe('data/research/registro_ricerche.yml', researchLogContent);

  // 5. NEXT_STEPS.md
  const nextStepsContent = `# Prossimi passi della ricerca

Questo documento tiene traccia dei fili di ricerca aperti e delle priorità per l'archivio.
Viene visualizzato solo nel profilo privato del sito statico.

## Ricerche prioritarie
- [ ] Definire la persona radice dell'albero e aggiungere l'atto di nascita/battesimo.
- [ ] Censire i registri parrocchiali e di stato civile disponibili.
`;
  writeFileSafe('NEXT_STEPS.md', nextStepsContent);

  // 6. .gitignore
  const gitignorePath = path.join(templatesDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    writeFileSafe('.gitignore', fs.readFileSync(gitignorePath, 'utf-8'));
  } else {
    writeFileSafe('.gitignore', `node_modules/\ndist/\nscansioni_da_leggere/\n.DS_Store\n`);
  }

  // 7. CLAUDE.md e AGENTS.md
  const claudePath = path.join(templatesDir, 'CLAUDE.md');
  if (fs.existsSync(claudePath)) {
    let claudeContent = fs.readFileSync(claudePath, 'utf-8');
    claudeContent = claudeContent.replace(/<Nome dell'archivio>/g, `Archivio ${archiveName}`);
    claudeContent = claudeContent.replace(/<Cognome>/g, archiveName);
    writeFileSafe('CLAUDE.md', claudeContent);
    writeFileSafe('AGENTS.md', claudeContent);
  }

  // 8. .githooks/pre-commit
  const hookPath = path.join(templatesDir, '.githooks', 'pre-commit');
  if (fs.existsSync(hookPath)) {
    writeFileSafe('.githooks/pre-commit', fs.readFileSync(hookPath, 'utf-8'), 0o755);
  }

  // 9. package.json se non esiste già
  const packageJsonPath = path.join(targetDir, 'package.json');
  if (!fs.existsSync(packageJsonPath) || force) {
    const slugName =
      archiveName
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'famiglia';
    const pkgTemplatePath = path.join(templatesDir, 'package.json');
    let pkgContent = '';
    if (fs.existsSync(pkgTemplatePath)) {
      pkgContent = fs.readFileSync(pkgTemplatePath, 'utf-8');
      pkgContent = pkgContent.replace(/"name": "archivio-di-famiglia"/, `"name": "archivio-${slugName}"`);
    } else {
      pkgContent = JSON.stringify(
        {
          name: `archivio-${slugName}`,
          private: true,
          type: 'module',
          scripts: {
            check: 'ancestors validate --strict',
            site: 'ancestors build --profile private',
            'site:public': 'ancestors build --profile public',
            prepare: 'git config core.hooksPath .githooks 2>/dev/null || true',
          },
          dependencies: {
            'ancestors-engine': 'github:EmmanueleVilla/ancestors-engine#v1.4.2',
          },
        },
        null,
        2
      );
    }
    writeFileSafe('package.json', pkgContent);
  } else {
    console.log(`  · File già presente (non sovrascritto): package.json`);
  }

  // 10. Configura la skill genealogy-crud-wizard in .agents/skills/
  const agentsSkillsDir = path.join(targetDir, '.agents', 'skills');
  const skillLinkPath = path.join(agentsSkillsDir, 'genealogy-crud-wizard');
  const relativeTarget = path.join('..', '..', 'node_modules', 'ancestors-engine', '.agents', 'skills', 'genealogy-crud-wizard');

  const existingLink = fs.lstatSync(skillLinkPath, { throwIfNoEntry: false });
  if (!existingLink || force) {
    if (existingLink && force) {
      fs.rmSync(skillLinkPath, { recursive: true, force: true });
    }
    fs.mkdirSync(agentsSkillsDir, { recursive: true });
    try {
      fs.symlinkSync(relativeTarget, skillLinkPath, 'dir');
      console.log(`  ✓ Creato symlink per la skill: .agents/skills/genealogy-crud-wizard -> ${relativeTarget}`);
    } catch {
      // Fallback su copia fisica se il file system non consente symlink (es. Windows senza permessi speciali)
      const sourceSkillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.agents/skills/genealogy-crud-wizard');
      if (fs.existsSync(sourceSkillDir)) {
        fs.cpSync(sourceSkillDir, skillLinkPath, { recursive: true });
        console.log(`  ✓ Copiata skill: .agents/skills/genealogy-crud-wizard`);
      }
    }
  } else {
    console.log(`  · Skill già collegata in: .agents/skills/genealogy-crud-wizard`);
  }

  console.log(`
Inizializzazione completata con successo!

Prossimi passi:
  1. Entra nella cartella (se diversa da quella attuale): cd ${path.relative(process.cwd(), targetDir) || '.'}
  2. Installa le dipendenze:
       npm install
  3. Modifica archivio.config.yml inserendo l'ID della persona radice in 'tree.root_id'.
  4. Aggiungi il primo atto con il supporto dell'assistente AI (o creando i primi file in data/).
  5. Esegui il controllo:
       npm run check
  6. Genera il sito locale:
       npm run site
`);

  return 0;
}
