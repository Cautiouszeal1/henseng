// Builds the HENSENG web app into the website (apps/web/public/app), served at https://<site>/app.
// Used by the Vercel build. On the website the app talks to the API on the same domain, so
// EXPO_PUBLIC_API_URL isn't needed; XMTP uses its production network unless EXPO_PUBLIC_XMTP_ENV says otherwise.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(app, "../web/public/app");
rmSync(out, { recursive: true, force: true });
const env = { ...process.env, EXPO_BASE_URL: "/app", CI: "1", EXPO_NO_TELEMETRY: "1" };
execFileSync("npx", ["expo", "export", "-p", "web", "--output-dir", out], { cwd: app, env, stdio: "inherit" });
execFileSync("node", [join(app, "scripts/copy-xmtp-wasm.mjs"), out], { cwd: app, stdio: "inherit" });
console.log(`HENSENG web app built into ${out}`);
