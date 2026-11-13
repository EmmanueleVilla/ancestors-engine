import { getSiteSettings, seriesColorsStyle } from '../site.js';

export function escapeHtml(str?: string | number | null): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function html(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((acc, str, i) => {
    const val = i < values.length ? values[i] : '';
    let formattedVal = '';
    if (Array.isArray(val)) {
      formattedVal = val.join('');
    } else if (val === null || val === undefined) {
      formattedVal = '';
    } else {
      formattedVal = String(val);
    }
    return acc + str + formattedVal;
  }, '');
}

export function safeJsonLd(data: object | object[]): string {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

export interface DocumentOptions {
  title: string;
  description?: string;
  rootRelPath?: string;
  headExtra?: string;
  jsonLd?: object | object[];
  bodyContent: string;
  bodyClass?: string;
}

export function renderDocument(options: DocumentOptions): string {
  const root = options.rootRelPath ?? './';
  const site = getSiteSettings();
  const desc = options.description || site.description;
  const jsonLdScript = options.jsonLd
    ? `\n  <script type="application/ld+json">\n${safeJsonLd(options.jsonLd)}\n  </script>`
    : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)} · ${escapeHtml(site.title)}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <link rel="preload" href="${root}assets/fonts/source-sans-3.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="${root}assets/fonts/source-serif-4.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${root}assets/css/main.css">
  <link rel="stylesheet" href="${root}assets/css/print.css" media="print">
  <script defer src="${root}assets/js/main.js"></script>
  ${seriesColorsStyle()}
  ${options.headExtra || ''}${jsonLdScript}
</head>
<body${options.bodyClass ? ` class="${escapeHtml(options.bodyClass)}"` : ''}>
  ${options.bodyContent}
</body>
</html>`;
}
