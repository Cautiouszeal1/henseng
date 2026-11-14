// Post-export fix-ups for XMTP on web (and the Chrome extension), run after `expo export -p web`.
//
// 1. XMTP's web worker loads `bindings_wasm_bg.wasm` relative to its own bundle URL,
//    but Metro doesn't emit the .wasm file. Copy it next to the exported JS bundles.
// 2. Metro rewrites `import.meta.url` to `globalThis.__ExpoImportMetaRegistry.url`, which
//    Expo's runtime only defines on the main page. Inside a Web Worker it's undefined and
//    the worker crashes. Prepend a tiny shim to any chunk that reads it, so `url` falls back
//    to the script's own location (the worker's bundle URL — exactly where the .wasm lives).
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const out = process.argv[2] ?? "dist";
const target = join(out, "_expo/static/js/web");
if (!existsSync(target)) throw new Error(`${target} not found. Run expo export -p web first.`);

const require = createRequire(import.meta.url);
const sdkRequire = createRequire(require.resolve("@xmtp/browser-sdk"));
const wasmDir = dirname(sdkRequire.resolve("@xmtp/wasm-bindings"));
const wasm = readdirSync(wasmDir).find((f) => f.endsWith(".wasm"));
if (!wasm) throw new Error(`No .wasm file found in ${wasmDir}`);
copyFileSync(join(wasmDir, wasm), join(target, wasm));
console.log(`Copied ${wasm} → ${target}`);

const SHIM =
  "if(typeof globalThis.__ExpoImportMetaRegistry==='undefined'){globalThis.__ExpoImportMetaRegistry={get url(){return globalThis.location?globalThis.location.href:''}}};\n";
let patched = 0;
for (const f of readdirSync(target)) {
  if (!f.endsWith(".js")) continue;
  const p = join(target, f);
  const src = readFileSync(p, "utf8");
  if (!src.includes("__ExpoImportMetaRegistry.url") || src.startsWith(SHIM)) continue;
  writeFileSync(p, SHIM + src);
  patched++;
}
console.log(`Patched import.meta shim into ${patched} chunk(s)`);
