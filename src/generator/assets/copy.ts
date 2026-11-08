import fs from 'node:fs';
import path from 'node:path';
import { Media } from '../../model/media.js';

export interface CopyMediaResult {
  copiedCount: number;
  missingFiles: string[];
}

/** Elenca i file multimediali referenziati che non esistono (senza copiare niente). */
export function findMissingMedia(mediaMap: Map<string, Media>, repoRoot: string): string[] {
  return [...mediaMap.values()]
    .filter((m) => !fs.existsSync(path.resolve(repoRoot, m.file_path)))
    .map((m) => m.file_path);
}

export function copyReferencedMedia(
  mediaMap: Map<string, Media>,
  repoRoot: string,
  outDir: string
): CopyMediaResult {
  const missingFiles: string[] = [];
  let copiedCount = 0;

  for (const media of mediaMap.values()) {
    const srcPath = path.resolve(repoRoot, media.file_path);
    if (!fs.existsSync(srcPath)) {
      missingFiles.push(media.file_path);
      continue;
    }

    const destPath = path.resolve(outDir, media.file_path);
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(srcPath, destPath);
    copiedCount++;
  }

  return { copiedCount, missingFiles };
}
