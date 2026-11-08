import fs from 'node:fs';
import path from 'node:path';
import { loadAndValidateDataset } from '../validator/index.js';
import { generateStaticSite } from '../generator/index.js';
import { applyPublicProfile } from '../privacy/filter.js';
import { findLeaks } from '../privacy/leak-check.js';
import { loadArchiveConfig } from '../config/archive.js';
import { copyReferencedMedia, findMissingMedia } from '../generator/assets/copy.js';
import { BuildProfile } from '../config/index.js';

export interface BuildCliOptions {
  dataDir?: string;
  assetsDir?: string;
  outDir?: string;
  /** File di configurazione dell'archivio (default: ./archivio.config.yml). */
  configPath?: string;
  profile?: BuildProfile;
  silent?: boolean;
  verbose?: boolean;
  strict?: boolean;
}

export function runBuildCommand(options: BuildCliOptions): number {
  const dataDir = path.resolve(options.dataDir || './data');
  const assetsDir = path.resolve(options.assetsDir || './assets');
  const outDir = path.resolve(options.outDir || './dist');
  const profile = options.profile || 'public';
  const silent = options.silent ?? false;
  const configPath = path.resolve(options.configPath || './archivio.config.yml');

  if (!silent) {
    console.log(`[INFO] Building genealogy archive...`);
    console.log(`       Data:    ${dataDir}`);
    console.log(`       Assets:  ${assetsDir}`);
    console.log(`       Output:  ${outDir}`);
    console.log(`       Profile: ${profile}`);
  }

  // 1. Validate dataset
  const validation = loadAndValidateDataset(dataDir);
  if (!validation.valid || !validation.dataset) {
    if (!silent) {
      console.error(`\n[ERROR] Build halted: Dataset validation failed with ${validation.errors.length} error(s):`);
      for (const err of validation.errors) {
        console.error(`  - [${err.field}] ${err.message} (${err.filePath})`);
      }
    }
    return 1;
  }

  if (validation.warnings.length > 0) {
    const strictErrors = options.strict ? validation.warnings.filter((w) => !w.nonBlocking) : [];
    if (strictErrors.length > 0) {
      if (!silent) console.error(`\n[ERROR] Build halted: ${strictErrors.length} warning(s) in strict mode. Run 'validate' to see them.`);
      return 1;
    }
    if (!silent) console.warn(`[WARN] ${validation.warnings.length} anomalie nei dati (dettagli con 'npm run validate').`);
  }

  // 2. Check that all referenced media files exist in assetsDir
  // I percorsi dei media sono relativi alla radice dell'archivio (la cartella che contiene data/).
  const archiveRoot = path.dirname(dataDir);
  const missingMedia = findMissingMedia(validation.dataset.media, archiveRoot);
  if (missingMedia.length > 0) {
    if (!silent) {
      console.error(`\n[ERROR] Build halted: Missing media file(s):`);
      for (const f of missingMedia) {
        console.error(`  - ${f}`);
      }
    }
    return 1;
  }

  // 3. Configurazione dell'archivio
  const configResult = loadArchiveConfig(configPath);
  if (configResult.error) {
    if (!silent) console.error(`\n[ERROR] Build halted: configurazione non valida (${configPath}): ${configResult.error}`);
    return 1;
  }
  const config = configResult.config;

  // 4. Apply privacy filter based on profile
  const isPublic = profile === 'public';
  const publicResult = isPublic
    ? applyPublicProfile(validation.dataset, {
        namedLivingIds: config.privacy.named_living_ids,
        pseudonymKey: config.privacy.pseudonym_key,
      })
    : undefined;
  const filteredDataset = publicResult ? publicResult.dataset : validation.dataset;
  const mapId = (id?: string) => (id && publicResult?.idMap.get(id)) || id;
  const treeLayout = {
    rootId: mapId(config.tree.root_id),
    mirrorRootId: mapId(config.tree.mirror_root_id),
    positions: Object.fromEntries(Object.entries(config.tree.positions).map(([id, pos]) => [mapId(id) as string, pos])),
  };

  // 4. Generate static site
  try {
    const nextStepsPath = config.next_steps_file
      ? path.resolve(path.dirname(configPath), config.next_steps_file)
      : path.join(path.dirname(dataDir), 'NEXT_STEPS.md');
    const s = config.site;
    generateStaticSite(filteredDataset, {
      outDir,
      profile,
      assetsDir,
      nextStepsMarkdown: fs.existsSync(nextStepsPath) ? fs.readFileSync(nextStepsPath, 'utf-8') : undefined,
      treeLayout,
      site: {
        ...(s.title ? { title: s.title } : {}),
        ...(s.subtitle ? { subtitle: s.subtitle } : {}),
        ...(s.description ? { description: s.description } : {}),
        ...(s.footer ? { footer: s.footer } : {}),
        ...(s.home_title ? { homeTitle: s.home_title } : {}),
        ...(s.home_intro ? { homeIntro: s.home_intro } : {}),
        rootPersonId: treeLayout.rootId,
        seriesColors: s.series_colors.map((c) => ({ color: c.color, onColor: c.on_color })),
      },
    });
    // Copia solo i media rimasti dopo il filtro privacy (nel profilo pubblico niente media dei vivi)
    // Prima si svuota la cartella dei media: un build privato precedente nella stessa cartella non deve lasciare file.
    fs.rmSync(path.join(outDir, 'data'), { recursive: true, force: true });
    copyReferencedMedia(filteredDataset.media, archiveRoot, outDir);

    // 5. Controllo anti-fuga sul profilo pubblico
    if (publicResult) {
      const leaks = findLeaks(outDir, validation.dataset, publicResult.maskedIds);
      if (leaks.length > 0) {
        if (!silent) {
          console.error(`\n[ERROR] Profilo pubblico: ${leaks.length} fuga/fughe di dati di persone vive:`);
          for (const l of leaks.slice(0, 50)) console.error(`  - "${l.needle}" (${l.personId}) in ${l.file}`);
          if (leaks.length > 50) console.error(`  ... e altre ${leaks.length - 50}`);
          console.error(`Correggi il testo nei dati (o la configurazione) e rigenera. Il sito in ${outDir} NON va pubblicato.`);
        }
        return 3;
      }
    }
    if (!silent) {
      console.log(`[SUCCESS] Static site generated successfully at ${outDir}`);
    }
    return 0;
  } catch (err: any) {
    if (!silent) {
      console.error(`[ERROR] Static site generation failed: ${err.message || String(err)}`);
    }
    return 2;
  }
}

