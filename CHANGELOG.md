# Changelog

All notable changes are documented here. Releases follow [Conventional Commits](https://www.conventionalcommits.org/) + semantic-release.

## [Unreleased]

### Fixed
- **core**: async request bị huỷ (AbortError) khi vẫn là request mới nhất không còn
  treo `isLoading() === true` vĩnh viễn — cờ `asyncLoading` được reset và UI re-render.

### Added
- **a11y**: bộ test xác minh đầy đủ pattern ARIA combobox (WAI-ARIA 1.2) —
  `aria-expanded/aria-controls/aria-autocomplete`, `role=option` + `aria-selected`,
  `aria-activedescendant` khi điều hướng bàn phím (virtual focus, không roving tabindex),
  live region `role=status`, lỗi `role=alert`. Unit (`src/a11y.test.ts`) + E2E (`e2e/a11y.spec.ts`).
- **test**: coverage gate nâng lên `95/95/85/95` (lines/statements/branches/functions)
  từ `80/80/75/80`. Toàn bộ nhánh async load, virtualize scroll, historyAdapter,
  sự kiện DOM và edge case của `core.ts` (99.7% lines) + `icons.ts` (fallbackStrip
  không DOMParser) đều có test.
- **ci**: chạy `test:coverage` (coverage gate) trong job lint-unit-build.
- **docs**: README bổ sung mục *Accessibility (ARIA combobox)*, *Async data source
  states* (loading/error/empty + `isLoading()`), *Known quirks* (hành vi dấu `,`
  trong `applySuggestion`) và option `historyKey` trong bảng API.

### Known quirks (documented, không đổi hành vi)
- `applySuggestion('react ,', 'TypeScript')` → `'react , TypeScript'`: dấu phẩy
  standalone được coi là từ riêng biệt; chỉ dấu phẩy cuối chuỗi (không có dấu cách
  phía trước) được dọn. Xem README mục *Known quirks*.

## [1.2.1]

### Fixed
- Restored the full status bar (scope, hits in groups, `replacing` pill,
  keyboard hints, `Apply (N) Enter ↵` / `Done ↵`). Only the `ms` timing is
  removed — it implied remote AI search while this library assumes local data.
  Elapsed time remains available via `telemetry.onSearch`.
- Reverted the v1.2.0 locale deprecation: `scope`, `in`, `groups`, `replacing`,
  `hintBrowse`, `hintMulti`, `hintApply` are first-class keys again.
- Refreshed `demo/screenshot.png`.

## [1.2.0]

### Changed (UI declutter)
- Status bar is now minimal: hits count + staged pill + Apply button.
- Removed `scope ALL`, per-group counts, `replacing` pill, keyboard hints and
  `Enter ↵` suffixes from the dropdown. Timing (`ms`) renders only with
  `debug: true` (elapsed time still flows via `telemetry.onSearch`).
- Old locale keys (`scope`, `tier`, `in`, `groups`, `replacing`, `hintBrowse`,
  `hintMulti`, `hintApply`) deprecated but still accepted.

### Added
- Extended `DesignTokens`: `fontFamily`, `fontSize`, `background`, `foreground`,
  `borderColor`, `mutedColor`, `dropdownRadius`, `shadow`, `cssVars` escape hatch
  (all mapped to per-instance `--sa-*` CSS variables).
- New CSS variables: `--sa-font`, `--sa-font-size`, `--sa-drop-radius`, `--sa-shadow`.
- New unit tests (60 total), refreshed `demo/screenshot.png`.

## [1.1.0] — Enterprise edition

### Added
- Async `dataSource` with debounce, `AbortController` cancellation, query cache, loading/error/empty states.
- Virtualization (`virtualizeThreshold`, default 200) with "showing N / M" footer.
- Allowlist SVG sanitizer for `submitIcon` / group icons (`sanitizeSvgMarkup`).
- Native form integration (`name` → hidden input, `getFormValue()`).
- Generic `SuggestionItem<T>` payloads.
- Pluggable history adapters (memory default, localStorage opt-in).
- Pluggable logger + `debug` flag, telemetry hooks (`onSearch/onSelect/onError`).
- Design tokens (`theme/density/direction/maxDropdownHeight`), RTL, reduced-motion, high-contrast support.
- Full keyboard nav (`Home/End/PageUp/PageDown`), screen-reader live region.
- Fixed React (forwardRef + prop sync), expanded Vue + Angular wrappers.
- CI matrix, bundle-size guard, npm provenance, SECURITY/CONTRIBUTING guides.

### Fixed
- Rollup banner now reads the version from `package.json` (was hardcoded `1.0.0`).
- Node engines raised to `>=18`.
