import { escapeHtml } from '../components/base.js';
import { renderLayout } from '../components/layout.js';
import { renderBreadcrumbs } from '../components/fascicolo.js';

/** Auto-link identifiers in text (people, families, sources, places). */
function autoLinkIdentifiers(text: string, rootRelPath: string): string {
  return text
    .replace(/\b(P\d+_[a-z0-9_]+)\b/g, `<a href="${rootRelPath}people/$1.html">$1</a>`)
    .replace(/\b(FAM\d+_[a-z0-9_]+)\b/g, `<a href="${rootRelPath}families/$1.html">$1</a>`)
    .replace(/\b(SRC\d+)\b/g, `<a href="${rootRelPath}sources/$1.html">$1</a>`)
    .replace(/\b(PLC\d+)\b/g, `<a href="${rootRelPath}places/$1.html">$1</a>`);
}

/** Inline markdown: escape first, then **bold**, `code`, and auto-link IDs. */
function renderInline(text: string, rootRelPath: string = './'): string {
  const formatted = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  return autoLinkIdentifiers(formatted, rootRelPath);
}

/**
 * Minimal markdown renderer for NEXT_STEPS.md: headings (#..###), "-" lists with one level of
 * nesting (2-space indent), "- [ ]" / "- [x]" checkboxes and paragraphs.
 */
export function renderSimpleMarkdown(md: string, rootRelPath: string = './'): string {
  const out: string[] = [];
  let listDepth = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length > 0) {
      out.push(`<p>${renderInline(para.join(' '), rootRelPath)}</p>`);
      para = [];
    }
  };
  const closeLists = (depth: number) => {
    while (listDepth > depth) {
      out.push('</li></ul>');
      listDepth--;
    }
  };

  for (const raw of md.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = /^(\s*)-\s+(.*)$/.exec(line);

    if (heading) {
      flushPara();
      closeLists(0);
      const level = heading[1].length;
      out.push(`<h${level + 1} class="next-steps-h${level}">${renderInline(heading[2], rootRelPath)}</h${level + 1}>`);
    } else if (item) {
      flushPara();
      const depth = Math.floor(item[1].length / 2) + 1;
      let text = item[2];
      let checkbox = '';
      const cb = /^\[( |x)\]\s+(.*)$/i.exec(text);
      if (cb) {
        checkbox = `<input type="checkbox" disabled${cb[1].toLowerCase() === 'x' ? ' checked' : ''}> `;
        text = cb[2];
      }
      if (depth > listDepth) {
        while (listDepth < depth) {
          out.push('<ul class="next-steps-list">');
          listDepth++;
        }
      } else {
        closeLists(depth);
        out.push('</li>');
      }
      out.push(`<li>${checkbox}${renderInline(text, rootRelPath)}`);
    } else if (line.trim() === '') {
      flushPara();
      closeLists(0);
    } else {
      closeLists(0);
      para.push(line.trim());
    }
  }
  flushPara();
  closeLists(0);
  return out.join('\n');
}

export function renderNextStepsPage(markdown: string, rootRelPath: string = './'): string {
  const breadcrumb = renderBreadcrumbs([
    { label: 'Archivio', href: `${rootRelPath}index.html` },
    { label: 'Prossimi passi' },
  ]);
  const content = `
  <div class="next-steps">
    ${breadcrumb}
    ${renderSimpleMarkdown(markdown, rootRelPath)}
  </div>
  `;
  return renderLayout({
    title: 'Prossimi passi',
    description: 'Filoni di indagine aperti e richieste da fare',
    rootRelPath,
    activeNav: 'next-steps',
    content,
  });
}
