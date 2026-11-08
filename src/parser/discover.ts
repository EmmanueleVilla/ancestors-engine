import fs from 'node:fs';
import path from 'node:path';

export type EntityCategory =
  | 'people'
  | 'families'
  | 'relationships'
  | 'events'
  | 'places'
  | 'sources'
  | 'citations'
  | 'media';

export interface DiscoveredFile {
  category: EntityCategory;
  filePath: string;
  relativePath: string;
  fileName: string;
}

export function scanDirectoryRecursive(dir: string, baseDir: string = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanDirectoryRecursive(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ext === '.yml' || ext === '.yaml') {
        files.push(fullPath);
      }
    }
  }

  return files;
}

export function discoverEntityFiles(dataDir: string): DiscoveredFile[] {
  const categories: EntityCategory[] = [
    'people',
    'families',
    'relationships',
    'events',
    'places',
    'sources',
    'media',
  ];

  const results: DiscoveredFile[] = [];

  for (const cat of categories) {
    const catDir = path.join(dataDir, cat);
    if (!fs.existsSync(catDir)) continue;

    const files = scanDirectoryRecursive(catDir);
    for (const file of files) {
      const relPath = path.relative(dataDir, file);
      // Check if it's inside citations subdirectory
      const isCitation = relPath.startsWith('sources/citations/') || relPath.startsWith('sources\\citations\\');
      results.push({
        category: isCitation ? 'citations' : cat,
        filePath: file,
        relativePath: relPath,
        fileName: path.basename(file),
      });
    }
  }

  return results;
}
