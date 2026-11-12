#!/usr/bin/env node
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runValidateCommand } from './validate.js';
import { runBuildCommand } from './build.js';
import { runExportCommand } from './export.js';
import { BuildProfile } from '../config/index.js';

function parseArgs(args: string[]) {
  const parsed: {
    command?: string;
    dataDir?: string;
    assetsDir?: string;
    outDir?: string;
    configPath?: string;
    profile?: BuildProfile;
    strict?: boolean;
    verbose?: boolean;
    silent?: boolean;
    help?: boolean;
    version?: boolean;
  } = {};

  let i = 0;
  if (args.length > 0 && !args[0].startsWith('-')) {
    parsed.command = args[0];
    i = 1;
  }

  for (; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--version' || arg === '-v') {
      parsed.version = true;
    } else if (arg === '--strict') {
      parsed.strict = true;
    } else if (arg === '--verbose') {
      parsed.verbose = true;
    } else if (arg === '--silent') {
      parsed.silent = true;
    } else if (arg === '--data-dir' || arg === '-d') {
      parsed.dataDir = args[++i];
    } else if (arg === '--assets-dir' || arg === '-a') {
      parsed.assetsDir = args[++i];
    } else if (arg === '--out' || arg === '-o') {
      parsed.outDir = args[++i];
    } else if (arg === '--config' || arg === '-c') {
      parsed.configPath = args[++i];
    } else if (arg === '--profile' || arg === '-p') {
      const val = args[++i];
      if (val === 'public' || val === 'private') {
        parsed.profile = val;
      }
    }
  }

  return parsed;
}

function printUsage() {
  console.log(`
Ancestors CLI — Lightweight Static-First Genealogy Archive

Usage:
  ancestors <command> [options]

Commands:
  validate               Validate schemas, referential integrity, and graph acyclicity
  build                  Generate static multi-page website and search index
  export                 Export the public-profile dataset as JSON (living people masked)

Options:
  -d, --data-dir <path>   Path to YAML data directory (default: ./data)
  -a, --assets-dir <path> Path to static assets directory (default: ./assets)
  -o, --out <path>        Target directory for static build (default: ./dist)
  -c, --config <path>     Archive configuration file (default: ./archivio.config.yml)
  -p, --profile <mode>    Build profile: public (default) or private
      --strict           Treat non-critical warnings as build failures
      --verbose          Show detailed progress and entity statistics
      --silent           Suppress non-error output
  -v, --version          Display version
  -h, --help             Display this help message

Examples:
  ancestors validate --data-dir ./data
  ancestors build --profile public --out ./dist
`);
}

export function main(argv: string[] = process.argv.slice(2)): number {
  const opts = parseArgs(argv);

  if (opts.version) {
    console.log('ancestors v0.1.0');
    return 0;
  }

  if (opts.help || !opts.command) {
    printUsage();
    return 0;
  }

  switch (opts.command) {
    case 'validate':
      return runValidateCommand({
        dataDir: opts.dataDir,
        configPath: opts.configPath,
        strict: opts.strict,
        verbose: opts.verbose,
        silent: opts.silent,
      });

    case 'build':
      return runBuildCommand({
        dataDir: opts.dataDir,
        assetsDir: opts.assetsDir,
        outDir: opts.outDir,
        configPath: opts.configPath,
        profile: opts.profile,
        strict: opts.strict,
        verbose: opts.verbose,
        silent: opts.silent,
      });

    case 'export':
      return runExportCommand({
        dataDir: opts.dataDir,
        outDir: opts.outDir,
        configPath: opts.configPath,
        silent: opts.silent,
      });

    default:
      console.error(`Unknown command: ${opts.command}`);
      printUsage();
      return 1;
  }
}

// Auto-run if executed directly, also through the npm bin symlink (node_modules/.bin/ancestors)
function isDirectRun(): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  try {
    return fs.realpathSync(arg) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return arg.endsWith('cli/index.ts') || arg.endsWith('cli/index.js');
  }
}

if (isDirectRun()) {
  const code = main();
  process.exit(code);
}
