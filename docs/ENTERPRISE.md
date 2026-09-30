# SAutocomplete — Enterprise Guide

This package is now enterprise-ready: sync + async, virtualized, sanitized,
form-friendly, observable, and governed.

## 1. Async remote search

```ts
const inst = createAutocomplete({
  container: '#editor',
  dataSource: async ({ query, signal }) => {
    const res = await fetch(`/api/suggest?q=${encodeURIComponent(query)}`, { signal });
    if (!res.ok) throw new Error(`suggest failed: ${res.status}`);
    return res.json(); // SuggestionItem[]
  },
  debounceMs: 200,   // default
  asyncCache: true,  // default — per-query FIFO cache (50 entries)
  onAsyncError: (err) => toast.error('Search unavailable'),
  telemetry: {
    onSearch: ({ query, hits, elapsedMs, source }) =>
      analytics.track('search', { query, hits, elapsedMs, source }),
    onError: (err) => sentry.captureException(err),
  },
});

// Refresh current query (e.g. retry button, filter change)
inst.reload();
inst.isLoading(); // for external spinners/skeletons
```

Behavior notes:
- Stale responses are discarded by request id; in-flight requests are aborted.
- Sync `items` remain as known labels (highlight) + fallback when no dataSource.
- Zero-hit sync keeps legacy hidden dropdown; async zero-hit renders `.sa-empty`.

## 2. Scale (10k+ rows)

```ts
createAutocomplete({
  container: '#editor',
  items: bigList, // or dataSource
  virtualizeThreshold: 200, // render first 200 + "showing 200 / 12,400" footer
  maxItemsPerGroup: 50,
  maxTotalItems: 500,
});
```

Run the perf bench: `npm run bench` (`src/matching.bench.ts`, 20k rows).

## 3. Forms

```ts
createAutocomplete({ container: '#editor', name: 'q', formJoin: ', ' });
// → <input type="hidden" name="q" value="..."> mirrors query + staged
// → inst.getFormValue()
```

Works with plain `<form>`, React Hook Form, VeeValidate, Angular Forms
(read `getFormValue()` / `queryChange`).

## 4. History persistence & privacy

Default is in-memory (GDPR-safe). Opt into persistence:

```ts
import { createLocalStorageHistory } from 'sautocomplete-suggestion';

createAutocomplete({
  container: '#editor',
  historyAdapter: createLocalStorageHistory('my-app:history', 5),
});
// or implement HistoryAdapter { load/save/clear } backed by IndexedDB / server
```

## 5. Theming / RTL / density

```ts
createAutocomplete({
  container: '#editor',
  color: '#4f46e5',
  borderRadius: 12,
  tokens: {
    theme: 'system',      // 'light' | 'dark' | 'system'
    density: 'compact',   // data-dense screens
    direction: 'auto',    // 'ltr' | 'rtl' | 'auto' (follows document.dir)
    maxDropdownHeight: 320,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 15,
    background: '#ffffff',
    foreground: '#1e293b',
    borderColor: '#e2e8f0',
    mutedColor: '#64748b',
    dropdownRadius: 14,
    shadow: '0 20px 50px rgba(15,23,42,.18)',
    cssVars: { '--sa-chip-gap': '10px' }, // escape hatch, per-instance scoped
  },
});
inst.setTheme('#4f46e5', '#4338ca');
```

Every token maps to a `--sa-*` CSS variable on the instance root (see token
table in `README.md`), so multiple themed instances coexist without global CSS.
CSS honors `prefers-color-scheme`, `prefers-reduced-motion`, `forced-colors`
(high contrast), and `:focus-visible` rings.

The status bar keeps its full content — scope, hits in groups, `replacing`
pill, staged pill, keyboard hints, Apply button — all overridable via `locale`.
Only the `ms` timing was removed in v1.2.1: it implied remote AI search while
this library assumes local data. Elapsed time still flows through
`telemetry.onSearch`.

## 6. Security model

- Labels/queries/history → `escapeHTML()`.
- `submitIcon` / group `icon` → `sanitizeSvgMarkup()` allowlist
  (`svg, path, circle, rect, line, polyline, polygon, g` + presentation attrs).
  Event handlers, `<script>`, `javascript:` stripped; unsafe markup → default icon.
- See `SECURITY.md`. Pin CDN with SRI; npm provenance enabled.

## 7. Observability

```ts
createAutocomplete({
  container: '#editor',
  debug: true, // console logger; or pass logger: customLogger
  telemetry: { onSearch, onSelect, onError },
});
```

## 8. Framework wrappers

- React: `forwardRef` + per-prop sync (`items/value/disabled/dropup/color/groups/...`).
- Vue: full props + watchers + `ready` event.
- Angular: full `@Input/@Output` incl. `dataSource`, `tokens`, `name`, `asyncError`.

## 9. Quality gates (CI)

`lint → unit (80% coverage thresholds) → build → size guard → e2e (chromium/firefox/webkit)`.
See `.github/workflows/ci.yml`, `scripts/check-size.mjs`, `.releaserc.json`.
