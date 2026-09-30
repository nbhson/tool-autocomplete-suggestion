# Contributing

## Branching & commits
- Branch from `main`: `feat/<scope>`, `fix/<scope>`, `docs/<scope>`.
- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `chore:`.
- Releases are automated with semantic-release on merge to `main`.

## Checks before push
```bash
npm run lint
npm run test
npm run build && npm run size
npm run test:e2e:chromium
```

## Adding features
- Keep runtime dependencies at **zero**. New deps need maintainer approval.
- Every user-visible string must go through `locale` (English default).
- Every `innerHTML` interpolation must be escaped or sanitized (`src/sanitizer.ts`, `src/icons.ts`).
- Add unit tests (`src/*.test.ts`) + update `demo/index.html` when UX changes.
