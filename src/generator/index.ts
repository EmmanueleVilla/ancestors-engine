import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NormalizedDataset } from '../validator/index.js';
import { renderHomePage } from './pages/home.js';
import { renderPersonPage } from './pages/person.js';
import { renderFamilyPage } from './pages/family.js';
import { renderTreePage, TreeLayout } from './pages/tree.js';
import { setSiteSettings, SiteSettings } from './site.js';
import { renderSourcesCataloguePage } from './pages/sources_catalogue.js';
import { renderSourcePage } from './pages/source.js';
import { renderPlacesDirectoryPage } from './pages/places.js';
import { renderPlacePage } from './pages/place.js';
import { renderSurnamesIndexPage } from './pages/surnames.js';
import { renderTimelinePage } from './pages/timeline.js';
import { renderSearchPage } from './pages/search.js';
import { compileSearchIndex } from './search/index.js';
import { renderNextStepsPage } from './pages/next_steps.js';
import { setNextStepsNav } from './components/layout.js';

export interface GenerateOptions {
  outDir: string;
  profile?: 'public' | 'private';
  assetsDir?: string;
  /** Markdown of NEXT_STEPS.md; rendered as next-steps.html (private profile only). */
  nextStepsMarkdown?: string;
  /** Layout dell'albero dalla configurazione dell'archivio (ID già pseudonimizzati nel profilo pubblico). */
  treeLayout?: TreeLayout;
  /** Radice dell'archivio: i file_path dei media sono relativi a questa cartella. */
  archiveRoot?: string;
  /** Titoli, testi, radice e colori dell'archivio. */
  site?: Partial<SiteSettings>;
}

export function generateStaticSite(dataset: NormalizedDataset, options: GenerateOptions): void {
  const outDir = path.resolve(options.outDir);
  setSiteSettings(options.site);

  // 1. Ensure target directory structure exists
  const dirs = [
    outDir,
    path.join(outDir, 'people'),
    path.join(outDir, 'families'),
    path.join(outDir, 'trees'),
    path.join(outDir, 'places'),
    path.join(outDir, 'sources'),
    path.join(outDir, 'surnames'),
    path.join(outDir, 'assets', 'css'),
    path.join(outDir, 'assets', 'js'),
  ];

  // Remove previously generated pages so renamed/deleted entities don't leave stale HTML behind
  // (outDir also holds the compiled CLI, so only the generated page folders are cleared)
  const generatedPageDirs = ['people', 'families', 'trees', 'places', 'sources', 'surnames'];
  for (const sub of generatedPageDirs) {
    fs.rmSync(path.join(outDir, sub), { recursive: true, force: true });
  }

  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  const nextStepsMarkdown = options.profile === 'private' ? options.nextStepsMarkdown : undefined;
  setNextStepsNav(!!nextStepsMarkdown);
  const nextStepsFile = path.join(outDir, 'next-steps.html');
  if (nextStepsMarkdown) {
    fs.writeFileSync(nextStepsFile, renderNextStepsPage(nextStepsMarkdown, './'), 'utf-8');
  } else {
    fs.rmSync(nextStepsFile, { force: true });
  }

  // 2. Render Home Page
  const homeHtml = renderHomePage(dataset, './');
  fs.writeFileSync(path.join(outDir, 'index.html'), homeHtml, 'utf-8');

  // 3. Render Person Profile Pages
  for (const person of dataset.people.values()) {
    const personHtml = renderPersonPage(person, dataset, '../');
    fs.writeFileSync(path.join(outDir, 'people', `${person.id}.html`), personHtml, 'utf-8');
  }

  // 4. Render Family Pages
  for (const family of dataset.families.values()) {
    const familyHtml = renderFamilyPage(family, dataset, '../');
    fs.writeFileSync(path.join(outDir, 'families', `${family.id}.html`), familyHtml, 'utf-8');
  }

  // 5. Render Tree Pages
  for (const person of dataset.people.values()) {
    const treeHtml = renderTreePage(person, dataset, '../', options.treeLayout);
    fs.writeFileSync(path.join(outDir, 'trees', `${person.id}.html`), treeHtml, 'utf-8');
  }

  // 6. Render Sources Catalogue & Source Pages
  const sourcesCatHtml = renderSourcesCataloguePage(dataset, '../');
  fs.writeFileSync(path.join(outDir, 'sources', 'index.html'), sourcesCatHtml, 'utf-8');

  for (const source of dataset.sources.values()) {
    const sourceHtml = renderSourcePage(source, dataset, '../');
    fs.writeFileSync(path.join(outDir, 'sources', `${source.id}.html`), sourceHtml, 'utf-8');
  }

  // 7. Render Places Directory & Place Pages
  const placesDirHtml = renderPlacesDirectoryPage(dataset, '../');
  fs.writeFileSync(path.join(outDir, 'places', 'index.html'), placesDirHtml, 'utf-8');

  for (const place of dataset.places.values()) {
    const placeHtml = renderPlacePage(place, dataset, '../');
    fs.writeFileSync(path.join(outDir, 'places', `${place.id}.html`), placeHtml, 'utf-8');
  }

  // 8. Render Surnames Directory Page
  const surnamesHtml = renderSurnamesIndexPage(dataset, '../');
  fs.writeFileSync(path.join(outDir, 'surnames', 'index.html'), surnamesHtml, 'utf-8');

  // 9. Render Master Timeline Page
  const timelineHtml = renderTimelinePage(dataset, './');
  fs.writeFileSync(path.join(outDir, 'timeline.html'), timelineHtml, 'utf-8');

  // 10. Render Search Page & Search Index
  const searchHtml = renderSearchPage('./');
  fs.writeFileSync(path.join(outDir, 'search.html'), searchHtml, 'utf-8');

  const searchIndex = compileSearchIndex(dataset);
  fs.writeFileSync(path.join(outDir, 'search-index.json'), JSON.stringify(searchIndex, null, 2), 'utf-8');

  // 11. Copy internal static CSS and JS assets
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidateAssetDirs = [
    path.join(currentDir, 'assets'),
    path.resolve(currentDir, '../../src/generator/assets'),
    path.resolve(currentDir, '../src/generator/assets'),
  ];

  const assetSrcDir = candidateAssetDirs.find(
    (dir) => fs.existsSync(dir) && fs.existsSync(path.join(dir, 'main.css'))
  ) || candidateAssetDirs[0];

  const cssFiles = ['main.css', 'print.css'];
  for (const file of cssFiles) {
    const srcPath = path.join(assetSrcDir, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(outDir, 'assets', 'css', file));
    }
  }

  const jsFiles = ['main.js', 'tree.js', 'search.js'];
  for (const file of jsFiles) {
    const srcPath = path.join(assetSrcDir, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(outDir, 'assets', 'js', file));
    }
  }

  const fontSrcDir = path.join(assetSrcDir, 'fonts');
  if (fs.existsSync(fontSrcDir)) {
    const outFontDir = path.join(outDir, 'assets', 'fonts');
    fs.mkdirSync(outFontDir, { recursive: true });
    for (const file of fs.readdirSync(fontSrcDir)) {
      if (file.endsWith('.woff2')) fs.copyFileSync(path.join(fontSrcDir, file), path.join(outFontDir, file));
    }
  }

  // 12. Copia solo i media del dataset (già filtrato dal profilo) in media/, dove le pagine li cercano.
  //     La cartella viene svuotata: un build precedente non deve lasciare file (per esempio media di persone vive).
  const outMediaDir = path.join(outDir, 'media');
  fs.rmSync(outMediaDir, { recursive: true, force: true });
  const archiveRoot = options.archiveRoot ? path.resolve(options.archiveRoot) : process.cwd();
  for (const med of dataset.media.values()) {
    const src = path.resolve(archiveRoot, med.file_path);
    if (!fs.existsSync(src)) continue;
    fs.mkdirSync(outMediaDir, { recursive: true });
    fs.copyFileSync(src, path.join(outMediaDir, path.basename(med.file_path)));
  }
}
