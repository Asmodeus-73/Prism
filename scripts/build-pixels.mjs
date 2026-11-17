// Compile le module Rust des calculs sur les pixels (pixels/) en WebAssembly et le range dans web/px/.
// Run: node scripts/build-pixels.mjs            (il faut Rust et la cible wasm32-unknown-unknown)
//      node scripts/build-pixels.mjs --check    (vérifie que web/px/prism_px.wasm correspond aux sources)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const crate = join(root, 'pixels');
execFileSync('cargo', ['build', '--locked', '--release', '--target', 'wasm32-unknown-unknown'], { cwd: crate, stdio: 'inherit' });
const built = readFileSync(join(crate, 'target', 'wasm32-unknown-unknown', 'release', 'prism_pixels.wasm'));
const dest = join(root, 'web', 'px', 'prism_px.wasm');
if (process.argv.includes('--check')) {
  if (!existsSync(dest) || !built.equals(readFileSync(dest))) {
    console.error('web/px/prism_px.wasm ne correspond pas à pixels/ : lancez node scripts/build-pixels.mjs');
    process.exit(1);
  }
  console.log('web/px/prism_px.wasm à jour');
} else {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, built);
  console.log('web/px/prism_px.wasm', built.length, 'octets');
}
