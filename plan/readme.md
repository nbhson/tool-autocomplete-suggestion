# Plan — tool-autocomplete-suggestion

Library autocomplete vanilla-TS, framework-agnostic (React/Vue/Angular wrappers), có e2e Playwright.

## Baseline audit (00:44, 28-10-2026)
- Tests: ❌ không chạy được ban đầu → sau khi cài lại deps: **60 tests pass** (9 files)
- Build: ✅ nhưng có warning `TS5069: Option 'declarationDir' cannot be specified without 'declaration'/'composite'`
- Lint: ✅ clean
- **Nghiêm trọng:** `package-lock.json` hỏng → `npm ci` / `npm install` sập với lỗi npm arborist `Cannot read properties of null (reading 'edgesOut')` (bug peer-set resolution npm 10.9.9 + Node 22)
- Test scripts dùng `npx vitest run` → rơi vào cache npx toàn cục, không dùng deps local → dễ gãy trên CI

## Roadmap
### P0 (chặn)
- [x] Cài lại deps: xoá lockfile hỏng, regenerate `package-lock.json`
- [x] Loại bỏ xung đột `yaml@1` (cssnano) ↔ `yaml@2` (vite): bỏ `rollup-plugin-postcss`, CSS được copy thẳng vào dist
- [x] `npm ci` chạy sạch từ đầu (đã verify: xoá node_modules → `npm ci` OK)
- [x] Đổi test scripts `npx vitest run` → `vitest run` (dùng binary local)
- [x] Fix TS5069 (tsconfig: declaration false, declarationDir bỏ; dts plugin lo types)
- [x] `npm audit`: 0 vulnerabilities (nâng `@rollup/plugin-terser` → ^1.0.2, vá serialize-javascript RCE high)
- [x] Build clean: dist chỉ chứa 6 file đúng, 0 warning

### P1 (chất lượng)
- [ ] Audit mã nguồn `src/` (accessibility, XSS sanitize, virtualization correctness)
- [ ] Chạy `test:coverage` — bổ sung test cho vùng còn trống
- [ ] e2e Playwright: chạy được trên chromium

### P2 (hardening)
- [ ] CI workflow (lint + test + build)
- [ ] README: hướng dẫn dev, contribution

## Self-review log
- _0:44_ Audit lần 1: cài deps xong, 60/60 pass, build OK (1 warning TS5069), lint clean.
- _0:55_ Commit 1 (P0): lockfile regenerate (2 vuln → 0), bỏ rollup-plugin-postcss + css-only, copy CSS trực tiếp, test scripts dùng local binary, fix TS5069 + dist stale. Gate: test 60/60 ✅, lint ✅, build 0 warning ✅, npm ci từ trắng ✅, npm audit 0 ✅, size-check OK.
