// Bundle-size guard — enterprise supply-chain hygiene.
// Fails CI when the dependency-free bundles grow unexpectedly.
import { statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const BUDGETS = {
  'dist/sautocomplete-suggestion.esm.js': 60 * 1024, // 60 KB
  'dist/sautocomplete-suggestion.umd.js': 60 * 1024,
  'dist/styles.css': 30 * 1024,
};

let failed = false;
for (const [rel, budget] of Object.entries(BUDGETS)) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) {
    console.error(`size-check: missing ${rel} (run npm run build first)`);
    failed = true;
    continue;
  }
  const bytes = statSync(p).size;
  const ok = bytes <= budget;
  console.log(`size-check: ${rel} ${(bytes / 1024).toFixed(1)} KB / ${(budget / 1024).toFixed(0)} KB ${ok ? 'OK' : 'OVER BUDGET'}`);
  if (!ok) failed = true;
}
process.exit(failed ? 1 : 0);
