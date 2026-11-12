import path from 'node:path';
import { loadAndValidateDataset } from '../validator/index.js';

export interface ValidateCliOptions {
  dataDir?: string;
  strict?: boolean;
  verbose?: boolean;
  silent?: boolean;
}

export function runValidateCommand(options: ValidateCliOptions): number {
  const dataDir = path.resolve(options.dataDir || './data');
  const silent = options.silent ?? false;

  if (!silent) {
    console.log(`[INFO] Scanning and validating dataset in ${dataDir}...`);
  }

  const result = loadAndValidateDataset(dataDir);

  if (!silent && options.verbose) {
    console.log(`[INFO] Discovered records:`);
    console.log(`       - People: ${result.stats.people}`);
    console.log(`       - Families: ${result.stats.families}`);
    console.log(`       - Explicit Relationships: ${result.stats.relationships}`);
    console.log(`       - Derived Relationships: ${result.stats.derivedRelationships}`);
    console.log(`       - Events: ${result.stats.events}`);
    console.log(`       - Places: ${result.stats.places}`);
    console.log(`       - Sources: ${result.stats.sources}`);
    console.log(`       - Citations: ${result.stats.citations}`);
    console.log(`       - Media: ${result.stats.media}`);
  }

  if (!result.valid) {
    if (!silent) {
      console.error(`\n[ERROR] Validation failed with ${result.errors.length} error(s):`);
      for (const err of result.errors) {
        console.error(`  - [${err.field}] ${err.message} (${err.filePath})`);
      }
    }
    return 1;
  }

  const strictErrors = options.strict ? result.warnings : [];
  const advisoryWarnings = options.strict ? [] : result.warnings;

  if (strictErrors.length > 0 && !silent) {
    console.warn(`\n[ERROR] ${strictErrors.length} anomali${strictErrors.length === 1 ? 'a' : 'e'} da controllare:`);
    for (const w of strictErrors) {
      console.warn(`  - [${w.field}] ${w.message} (${path.relative(process.cwd(), w.filePath)})`);
    }
    console.warn('');
  }

  if (advisoryWarnings.length > 0 && !silent) {
    console.warn(`\n[WARN] ${advisoryWarnings.length} anomali${advisoryWarnings.length === 1 ? 'a' : 'e'} da controllare:`);
    for (const w of advisoryWarnings) {
      console.warn(`  - [${w.field}] ${w.message} (${path.relative(process.cwd(), w.filePath)})`);
    }
    console.warn('');
  }

  if (strictErrors.length > 0) {
    if (!silent) console.error(`[ERROR] Validation failed in strict mode: ${strictErrors.length} warning(s).`);
    return 1;
  }

  if (!silent) {
    console.log(`[SUCCESS] Dataset is valid! (0 errors, ${result.warnings.length} warnings, ${result.stats.people} people, ${result.stats.families} families, ${result.stats.derivedRelationships} relationships derived)`);
  }
  return 0;
}
