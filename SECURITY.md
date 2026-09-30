# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | ✅ Active  |

## Rendering / XSS model

- All item labels, queries and history entries are escaped via `escapeHTML()` before `innerHTML`.
- `submitIcon` and group `icon` pass through an allowlist SVG sanitizer (`sanitizeSvgMarkup()` in `src/icons.ts`).
  Only `svg, path, circle, rect, line, polyline, polygon, g` tags and presentation
  attributes are kept. Event-handler attributes, `script` tags and
  `javascript:` URLs are stripped. Unsafe markup falls back to the default icon.
- Do **not** pass unsanitized user input as `submitIcon`/`icon`. Prefer static
  icon constants reviewed in code review.

## Reporting a vulnerability

Open a GitHub Security Advisory or contact the maintainers privately.
Please include: affected version, reproduction, and impact assessment.
We aim to acknowledge within 2 business days and ship a patch release ASAP.

## CDN / supply chain

- Pin exact versions with Subresource Integrity (SRI) hashes in production.
- npm provenance is enabled (`publishConfig.provenance`), so each release
  carries a verifiable build attestation.
