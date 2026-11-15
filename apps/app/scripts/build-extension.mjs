// Builds the HENSENG Chrome extension (Manifest V3) from the web app:
//   1. expo export -p web  (EXPO_PUBLIC_* variables are read from your environment / .env as usual)
//   2. copy XMTP's wasm next to the bundles and shim import.meta in workers
//   3. rename paths starting with "_" (Chrome refuses them) and rewrite every reference
//   4. add boot.js, background.js, icons and manifest.json, then check the result
//   5. zip it for the Chrome Web Store → dist-extension.zip
import { execSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { zipSync } from "fflate";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "dist-extension");
const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit", env: { ...process.env, EXPO_PUBLIC_RUNTIME: "extension" } });

if (process.argv.includes("--skip-export") && existsSync(out)) {
  console.log("Reusing existing export");
} else {
  rmSync(out, { recursive: true, force: true });
  run(`npx expo export -p web --output-dir dist-extension`);
}
run(`node scripts/copy-xmtp-wasm.mjs dist-extension`);

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? [p, ...walk(p)] : [p];
});

// 3. Rename "_…" files and folders, deepest first, recording old → new names.
const renames = new Map();
for (const p of walk(out).sort((a, b) => b.length - a.length)) {
  const name = p.split("/").pop();
  if (!name.startsWith("_")) continue;
  const next = "x" + name.replace(/^_+/, "");
  renames.set(name, next);
  renameSync(p, join(p, "..", next));
}
const textFiles = walk(out).filter((p) => /\.(js|html|json|css|map)$/.test(p) && statSync(p).isFile());
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Replace whole path segments only: preceded by "/" and followed by "/", "." (extension) or a quote.
const patterns = [...renames].map(([from, to]) => [new RegExp(`(?<=/)${escapeRe(from)}(?=[/"'\`?#]|$)`, "g"), to]);
for (const f of textFiles) {
  let s = readFileSync(f, "utf8");
  const before = s;
  for (const [re, to] of patterns) s = s.replace(re, to);
  if (s !== before) writeFileSync(f, s);
}

// 4. Extension files.
const ext = join(root, "extension");
cpSync(join(ext, "icons"), join(out, "icons"), { recursive: true });
cpSync(join(ext, "background.js"), join(out, "background.js"));
cpSync(join(ext, "boot.js"), join(out, "boot.js"));
const index = join(out, "index.html");
writeFileSync(index, readFileSync(index, "utf8").replace("<script ", '<script src="/boot.js"></script><script '));
const version = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo.version;
writeFileSync(join(out, "manifest.json"), readFileSync(join(ext, "manifest.template.json"), "utf8").replace("__VERSION__", version));
rmSync(join(out, "metadata.json"), { force: true });

// Checks: nothing Chrome would reject, no inline scripts (blocked by the extension CSP), no stale references.
const problems = [];
for (const p of walk(out)) if (p.split("/").pop().startsWith("_")) problems.push(`reserved name: ${relative(out, p)}`);
const html = readFileSync(index, "utf8");
if (/<script(?![^>]*\bsrc=)[^>]*>/.test(html)) problems.push("inline <script> in index.html");
for (const f of textFiles.filter((x) => existsSync(x))) {
  const s = readFileSync(f, "utf8");
  for (const [from] of renames) if (new RegExp(`/${escapeRe(from)}(?=[/"'\`])`).test(s)) problems.push(`stale reference to ${from} in ${relative(out, f)}`);
}
if (problems.length) {
  console.error("Extension build problems:\n  " + problems.join("\n  "));
  process.exit(1);
}

// 5. Zip.
const files = {};
for (const p of walk(out)) if (statSync(p).isFile()) files[relative(out, p)] = readFileSync(p);
writeFileSync(join(root, "dist-extension.zip"), zipSync(files, { level: 9 }));
const mb = (statSync(join(root, "dist-extension.zip")).size / 1048576).toFixed(1);
console.log(`Extension ready: dist-extension/ (load unpacked) and dist-extension.zip (${mb} MB, Chrome Web Store), version ${version}`);
