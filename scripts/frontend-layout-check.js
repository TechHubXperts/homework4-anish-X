/**
 * Frontend-only layout checks for pre-commit (no backend / API routes).
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const fail = (msg) => {
  console.error(`\nFrontend layout check failed:\n  ${msg}\n`);
  process.exit(1);
};

const mustExist = (p, label) => {
  if (!fs.existsSync(p)) fail(`${label} missing: ${path.relative(root, p)}`);
};

mustExist(path.join(root, "frontend"), "`frontend/` directory");
mustExist(path.join(root, "frontend/package.json"), "`frontend/package.json`");

const vitePath = path.join(root, "frontend/vite.config.js");
const viteTsPath = path.join(root, "frontend/vite.config.ts");
const viteResolved = fs.existsSync(vitePath)
  ? vitePath
  : fs.existsSync(viteTsPath)
    ? viteTsPath
    : null;
if (!viteResolved) {
  fail("`frontend/vite.config.js` or `frontend/vite.config.ts` is required.");
}
const viteSrc = fs.readFileSync(viteResolved, "utf8");
if (!viteSrc.includes("5173")) {
  fail(
    "`frontend/vite.config.*` must set dev server port 5173 (e.g. `port: 5173`).",
  );
}

const envPaths = [
  path.join(root, ".env"),
  path.join(root, "frontend/.env"),
];
for (const envPath of envPaths) {
  if (!fs.existsSync(envPath)) continue;
  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw.split(/\r?\n/);
  const allowed = new Set(["MONGODB_URI", "PORT", "NODE_ENV"]);
  const disallowedPrefix =
    /^(DATABASE_URL|DB_|POSTGRES|MYSQL|REDIS|MONGO_URI|MONGODB_URL|ATLAS_)/i;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (allowed.has(key)) continue;
    if (key.startsWith("VITE_")) continue;
    if (disallowedPrefix.test(key)) {
      fail(
        `${path.relative(root, envPath)}: disallowed DB-related key "${key}". Prefer VITE_* for client-safe vars.`,
      );
    }
    if (/^MONGO/i.test(key) && key !== "MONGODB_URI") {
      fail(
        `${path.relative(root, envPath)}: disallowed key "${key}". Only MONGODB_URI is allowed for Mongo-style variables.`,
      );
    }
  }
}

try {
  const tracked = execSync("git ls-files -- .env frontend/.env", {
    encoding: "utf8",
    cwd: root,
  }).trim();
  if (tracked) {
    fail(
      ".env or frontend/.env is tracked by git. Remove from the index (keep locally; env files must stay gitignored).",
    );
  }
} catch {
  // not a git repo or git missing — skip tracked check
}

const gitignorePath = path.join(root, ".gitignore");
mustExist(gitignorePath, "`.gitignore`");
const gitignore = fs.readFileSync(gitignorePath, "utf8");
if (!/^\s*\.env\s*$/m.test(gitignore) && !/\.env\b/.test(gitignore)) {
  fail("`.gitignore` must ignore env files (include a `.env` pattern).");
}

console.log("Frontend layout checks passed.");
