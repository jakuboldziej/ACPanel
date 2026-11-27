import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, vi } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const created: string[] = [];

afterAll(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

export function tmpDir(prefix = "acpanel-test-"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  created.push(dir);
  return dir;
}

export function makeFixture(): string {
  const dir = tmpDir("acpanel-fixture-");
  execFileSync("node", [path.join(repoRoot, "scripts", "make-fixture.mjs")], { cwd: dir, stdio: "ignore" });
  return path.join(dir, "dev-ac");
}

export async function withAcRoot(acRoot: string): Promise<void> {
  vi.resetModules();
  process.env.AC_ROOT = acRoot;
  process.env.UPLOADS_DIR = "";
  process.env.BACKUPS_DIR = "";
  process.env.PRESETS_DIR = "";
  process.env.CONTENT_CACHE_DIR = "";
  process.env.PUBLIC_URL = "https://panel.example";
}

export function hasCommand(cmd: string): boolean {
  try {
    execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
