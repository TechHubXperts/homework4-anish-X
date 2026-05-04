import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const rootDir = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../..",
);

const fail = (message) => {
  throw new Error(message);
};

const fileExists = (relativePath) =>
  fs.existsSync(path.join(rootDir, relativePath));

const readFile = (relativePath) =>
  fs.readFileSync(path.join(rootDir, relativePath), "utf8");

export const validateStaticContracts = () => {
  const rootItems = fs.readdirSync(rootDir, { withFileTypes: true });
  const appDirs = rootItems.filter((d) => d.isDirectory()).map((d) => d.name);

  if (!appDirs.includes("frontend")) {
    fail(`Root structure contract failed: frontend/ must exist.`);
  }

  if (!fileExists("frontend/package.json")) {
    fail(
      "Required manifest contract failed: frontend/package.json must exist.",
    );
  }

  const viteConfigPath = fileExists("frontend/vite.config.js")
    ? "frontend/vite.config.js"
    : "frontend/vite.config.ts";
  if (!fileExists(viteConfigPath)) {
    fail(
      "Frontend entrypoint contract failed: Vite config missing in frontend/.",
    );
  }

  const viteConfig = readFile(viteConfigPath);
  if (!/5173/.test(viteConfig)) {
    fail(
      "Frontend port contract failed: set frontend/vite.config.* server.port to 5173.",
    );
  }

  const envPaths = [path.join(rootDir, ".env"), path.join(rootDir, "frontend/.env")];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const envContent = fs.readFileSync(envPath, "utf8");
    const envKeys = envContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=")[0].trim());

    const disallowedDbKey = envKeys.find((key) => {
      const normalized = key.toUpperCase();
      const looksLikeDbKey =
        normalized.includes("DATABASE") ||
        normalized.startsWith("DB_") ||
        normalized.endsWith("_DB") ||
        normalized.includes("MONGO");
      return looksLikeDbKey && normalized !== "MONGODB_URI";
    });

    if (disallowedDbKey) {
      fail(
        `Database env contract failed: use MONGODB_URI only (found "${disallowedDbKey}").`,
      );
    }
  }

  const ignoredCheck = spawnSync("git", ["check-ignore", "-q", ".env"], {
    cwd: rootDir,
    stdio: "ignore",
  });
  if (ignoredCheck.status !== 0) {
    fail("Secrets contract failed: .env must be listed in .gitignore.");
  }

  const trackedCheck = spawnSync("git", ["ls-files", "--error-unmatch", ".env"], {
    cwd: rootDir,
    stdio: "ignore",
  });
  if (trackedCheck.status === 0) {
    fail(
      "Secrets contract failed: .env is tracked by git; untrack it before commit/push.",
    );
  }

  const trackedFrontendEnv = spawnSync(
    "git",
    ["ls-files", "--error-unmatch", "frontend/.env"],
    {
      cwd: rootDir,
      stdio: "ignore",
    },
  );
  if (trackedFrontendEnv.status === 0) {
    fail(
      "Secrets contract failed: frontend/.env is tracked by git; untrack it before commit/push.",
    );
  }
};
