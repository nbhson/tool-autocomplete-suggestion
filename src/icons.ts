/**
 * SVG sanitizer — allowlist-based, zero dependencies.
 * `submitIcon` / group `icon` are the only innerHTML sinks besides escaped
 * labels; they must pass through here before render.
 */
import { escapeAttr } from './sanitizer';

const ALLOWED_TAGS = new Set(['svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g']);
const ALLOWED_ATTRS = new Set([
  'width',
  'height',
  'viewBox',
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'd',
  'cx',
  'cy',
  'r',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'points',
  'transform',
  'aria-hidden',
  'class',
]);

function sanitizeAttrValue(v: string): string {
  const t = v.trim();
  // Block event handlers, scripts and external refs
  if (/^\s*javascript:/i.test(t)) return '';
  if (/on\w+\s*=/i.test(t)) return '';
  if (/<\s*script/i.test(t)) return '';
  return t;
}

/** Strip disallowed tags/attrs; returns '' when nothing safe remains. */
export function sanitizeSvgMarkup(markup: string): string {
  if (!markup || typeof markup !== 'string') return '';
  // Fast reject: event-handler attributes or script tags anywhere
  if (/\son\w+\s*=/i.test(markup)) {
    // continue with filtering instead of hard reject — strip them below
  }
  try {
    const doc =
      typeof DOMParser !== 'undefined'
        ? new DOMParser().parseFromString(`<root>${markup}</root>`, 'text/html')
        : null;
    if (!doc) return fallbackStrip(markup);
    const root = doc.querySelector('root');
    if (!root) return '';
    const out: string[] = [];
    const walk = (node: Node): string => {
      let html = '';
      node.childNodes.forEach((child) => {
        if (child.nodeType === 3) return; // text nodes inside icons are noise
        if (child.nodeType !== 1) return;
        const el = child as Element;
        const tag = el.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tag)) {
          html += walk(el); // unwrap disallowed wrappers, keep safe children
          return;
        }
        const attrs: string[] = [];
        for (const name of el.getAttributeNames()) {
          const lower = name.toLowerCase();
          // data-* attributes are inert (no script execution) — keep for testing/styling hooks
          if (!ALLOWED_ATTRS.has(lower) && !lower.startsWith('data-')) continue;
          const safe = sanitizeAttrValue(el.getAttribute(name) ?? '');
          if (safe === '' && lower !== 'fill' && lower !== 'stroke') continue;
          attrs.push(`${lower}="${escapeAttr(safe)}"`);
        }
        html += `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}>${walk(el)}</${tag}>`;
      });
      return html;
    };
    out.push(walk(root));
    const result = out.join('').trim();
    return /<(svg|path|circle|rect|line|polyline|polygon|g)[\s>]/.test(result) ? result : '';
  } catch {
    return fallbackStrip(markup);
  }
}

/** Regex fallback for non-DOM runtimes (SSR / old jsdom). */
function fallbackStrip(markup: string): string {
  let s = markup.replace(/<script[\s\S]*?<\/script\s*>/gi, '');
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/(href|xlink:href)\s*=\s*("[^"]*"|'[^']*')/gi, '');
  s = s.replace(/javascript:/gi, '');
  const m = s.match(/<svg[\s\S]*?<\/svg\s*>/i) ?? s.match(/<svg[\s\S]*?\/>/i);
  return m ? m[0].slice(0, 4000) : '';
}

export function isSafeSvgMarkup(markup: string): boolean {
  return sanitizeSvgMarkup(markup).length > 0;
}
