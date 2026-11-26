import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertSafeTree, listArchive } from "../src/lib/archive.js";
import { hasCommand, tmpDir } from "./helpers.js";

const can = hasCommand("7z") && hasCommand("python3");

function pyZip(file: string, script: string): void {
  execFileSync("python3", ["-c", `import zipfile\nz=zipfile.ZipFile(${JSON.stringify(file)},'w')\n${script}\nz.close()`]);
}

describe.skipIf(!can)("archive checks", () => {
  it("lists a normal archive", async () => {
    const dir = tmpDir();
    const file = path.join(dir, "ok.zip");
    pyZip(file, "z.writestr('car/data.acd','x'*10)");
    expect(await listArchive(file)).toMatchObject({ files: 1, unpackedBytes: 10 });
  });

  it("rejects path traversal", async () => {
    const file = path.join(tmpDir(), "evil.zip");
    pyZip(file, "z.writestr('../../escape.txt','x')");
    await expect(listArchive(file)).rejects.toThrow(/unsafe path/);
  });

  it("rejects symlinks", async () => {
    const file = path.join(tmpDir(), "link.zip");
    pyZip(
      file,
      "i=zipfile.ZipInfo('car/data.acd')\ni.create_system=3\ni.external_attr=(0o120777<<16)\nz.writestr(i,'/etc/passwd')",
    );
    await expect(listArchive(file)).rejects.toThrow(/symlink/);
  });

  it("rejects files that are not archives", async () => {
    const file = path.join(tmpDir(), "fake.zip");
    fs.writeFileSync(file, "not an archive");
    await expect(listArchive(file)).rejects.toThrow(/Cannot read archive/);
  });
});

describe("assertSafeTree", () => {
  it("finds symlinks in an extracted tree", async () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, "a"));
    fs.symlinkSync("/etc", path.join(dir, "a", "link"));
    await expect(assertSafeTree(dir)).rejects.toThrow(/symlink/);
  });
});
