import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { HttpError } from "./fsutil.js";

export interface ArchiveListing {
  files: number;
  unpackedBytes: number;
}

function run7z(args: string[], timeoutMs: number): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.sevenZip, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (d: string) => {
      if (stdout.length < 50_000_000) stdout += d;
    });
    child.stderr.setEncoding("utf8").on("data", (d: string) => {
      if (stderr.length < 100_000) stderr += d;
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new HttpError(500, `Cannot run ${config.sevenZip}: ${e.message}. Install 7zip on the server`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

function isUnsafePath(p: string): boolean {
  const norm = p.replace(/\\/g, "/");
  return norm.startsWith("/") || /^[A-Za-z]:/.test(norm) || norm.split("/").includes("..");
}

export async function listArchive(file: string): Promise<ArchiveListing> {
  const r = await run7z(["l", "-slt", "-ba", "-sccUTF-8", "-pacpanel-no-password", file], 5 * 60_000);
  if (r.code !== 0) {
    const reason = /wrong password|encrypted/i.test(r.stderr + r.stdout)
      ? "the archive is password protected"
      : r.stderr.trim().split("\n").pop() || `7z exit code ${r.code}`;
    throw new HttpError(400, `Cannot read archive: ${reason}`);
  }

  let files = 0;
  let unpackedBytes = 0;
  for (const block of r.stdout.split(/\n\s*\n/)) {
    const fields = new Map<string, string>();
    for (const line of block.split("\n")) {
      const eq = line.indexOf(" = ");
      if (eq > 0) fields.set(line.slice(0, eq).trim(), line.slice(eq + 3).trim());
    }
    const p = fields.get("Path");
    if (!p) continue;
    if (isUnsafePath(p)) throw new HttpError(400, `Archive contains an unsafe path: ${p}`);
    const attrs = fields.get("Attributes") ?? "";
    const linked = ["Symbolic Link", "Hard Link", "Link"].some((k) => (fields.get(k) ?? "") !== "");
    if (/\bl[r-][w-][x-]/.test(attrs) || linked) {
      throw new HttpError(400, `Archive contains a symlink: ${p}`);
    }
    if (fields.get("Folder") === "+") continue;
    files++;
    unpackedBytes += Number(fields.get("Size") ?? 0) || 0;
  }

  if (files > 200_000) throw new HttpError(400, "Archive contains too many files");
  if (unpackedBytes > config.maxExtractMb * 1024 * 1024) {
    throw new HttpError(400, `Archive unpacks to ${(unpackedBytes / 1024 ** 3).toFixed(1)} GB, limit is ${(config.maxExtractMb / 1024).toFixed(1)} GB`);
  }
  return { files, unpackedBytes };
}

export async function extractArchive(file: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const r = await run7z(["x", "-y", "-bd", "-sccUTF-8", "-pacpanel-no-password", `-o${dest}`, file], 60 * 60_000);
  if (r.code !== 0) {
    if (/unsupported method/i.test(r.stderr) && /\.rar$/i.test(file)) {
      throw new HttpError(400, "This 7z build cannot unpack RAR files. Install RAR support on the server: sudo apt install 7zip-rar");
    }
    const reason = /wrong password|encrypted/i.test(r.stderr)
      ? "the archive is password protected"
      : r.stderr.trim().split("\n").pop() || `7z exit code ${r.code}`;
    throw new HttpError(400, `Extraction failed: ${reason}`);
  }
  await assertSafeTree(dest);
}

export async function assertSafeTree(root: string): Promise<void> {
  const realRoot = await fs.realpath(root);
  const stack = [realRoot];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) throw new HttpError(400, `Archive produced a symlink: ${path.relative(realRoot, full)}`);
      if (e.isDirectory()) stack.push(full);
    }
  }
}

export async function dirSize(root: string): Promise<number> {
  let total = 0;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) total += (await fs.stat(full)).size;
    }
  }
  return total;
}
