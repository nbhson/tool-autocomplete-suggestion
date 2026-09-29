/**
 * Minimal XSS-safe HTML escaping for SAutocomplete Suggestion.
 * All item labels, queries and history entries are rendered via innerHTML,
 * so every interpolated string must go through escapeHTML().
 */

/** Escape a string for safe interpolation into HTML. */
export function escapeHTML(value: string): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

/** Escape a string for safe use inside an HTML attribute value. */
export function escapeAttr(value: string): string {
  return escapeHTML(value).replace(/`/g, '&#96;');
}
