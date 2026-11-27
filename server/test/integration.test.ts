import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "vitest";
import { hasCommand, makeFixture, tmpDir, withAcRoot } from "./helpers.js";

let acRoot: string;

beforeEach(async () => {
  acRoot = makeFixture();
  await withAcRoot(acRoot);
});

const enabledCars = () => fs.readdirSync(path.join(acRoot, "content", "cars")).sort();

describe("cars", () => {
  it("enables and disables cars and writes entry_list", async () => {
    const { applyCars } = await import("../src/modules/cars/service.js");
    const res = await applyCars(["abarth500", "bmw_m3_e30"], 3);
    expect(res.enable).toEqual(["abarth500"]);
    expect(enabledCars()).toEqual(["abarth500", "bmw_m3_e30"]);
    const cfg = fs.readFileSync(path.join(acRoot, "cfg", "server_cfg.ini"), "utf8");
    expect(cfg).toContain("CARS=abarth500;bmw_m3_e30");
    expect(cfg).toContain("MAX_CLIENTS=6");
  });

  it("refuses empty placeholder folders and unsafe names", async () => {
    const { applyCars } = await import("../src/modules/cars/service.js");
    await expect(applyCars(["ks_empty_placeholder"])).rejects.toThrow(/empty folder/);
    await expect(applyCars(["../etc"])).rejects.toThrow(/Invalid name/);
  });
});

describe("presets", () => {
  it("saves, detects as current and restores cars and track", async () => {
    const presets = await import("../src/modules/presets/service.js");
    const cars = await import("../src/modules/cars/service.js");
    const tracks = await import("../src/modules/tracks/service.js");

    const saved = await presets.savePreset("gt", false);
    expect(saved.find((p) => p.name === "gt")).toMatchObject({ active: true, track: "ks_nordschleife", slots: 9 });
    await expect(presets.savePreset("gt", false)).rejects.toThrow(/already exists/);

    await cars.applyCars(["abarth500"], 3);
    await tracks.applyTrack("magione", "", 3);
    expect((await presets.listPresets())[0]!.active).toBe(false);

    const res = await presets.applyPreset("gt");
    expect(res.disabled).toEqual(["abarth500"]);
    expect(enabledCars()).toEqual(["bmw_m3_e30", "ks_ferrari_488_gt3", "ks_mazda_mx5_cup"]);
    expect((await presets.listPresets())[0]!.active).toBe(true);
  });

  it("refuses presets with missing cars", async () => {
    const presets = await import("../src/modules/presets/service.js");
    const dir = path.join(acRoot, "presets", "broken");
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(acRoot, "cfg", "server_cfg.ini"), path.join(dir, "server_cfg.ini"));
    fs.writeFileSync(path.join(dir, "entry_list.ini"), "[CAR_0]\nMODEL=not_installed\n");
    await expect(presets.applyPreset("broken")).rejects.toThrow(/not_installed/);
    await expect(presets.applyPreset("../x")).rejects.toThrow(/Invalid name/);
  });
});

describe.skipIf(!hasCommand("7z"))("mod upload", () => {
  it("uploads, detects and installs a car with stripping", async () => {
    const src = tmpDir();
    const car = path.join(src, "test_car");
    fs.mkdirSync(path.join(car, "skins", "red"), { recursive: true });
    fs.mkdirSync(path.join(car, "ui"));
    fs.writeFileSync(path.join(car, "data.acd"), "x");
    fs.writeFileSync(path.join(car, "collider.kn5"), "x");
    fs.writeFileSync(path.join(car, "test_car.kn5"), Buffer.alloc(100_000));
    fs.writeFileSync(path.join(car, "skins", "red", "preview.jpg"), "jpg");
    fs.writeFileSync(path.join(car, "skins", "red", "livery.png"), "png");
    fs.writeFileSync(path.join(car, "ui", "ui_car.json"), '{ "name": "Test Car" }');
    const archive = path.join(src, "test_car.zip");
    execFileSync("7z", ["a", "-bd", archive, "test_car"], { cwd: src, stdio: "ignore" });
    const bytes = fs.readFileSync(archive);

    const mods = await import("../src/modules/mods/service.js");
    const created = await mods.createUpload("test_car.zip", bytes.length);
    await mods.writeChunk(created.id, 0, Readable.from(bytes));
    await mods.completeUpload(created.id);
    let upload = await mods.getUpload(created.id);
    for (let i = 0; i < 50 && upload.status === "extracting"; i++) {
      await new Promise((r) => setTimeout(r, 100));
      upload = await mods.getUpload(created.id);
    }
    expect(upload.status).toBe("ready");
    expect(upload.items).toEqual([
      expect.objectContaining({ kind: "car", id: "test_car", name: "Test Car", existing: null, image: "preview" }),
    ]);

    const res = await mods.installUpload(created.id, [{ key: upload.items[0]!.key, overwrite: false }], true);
    expect(res.installed[0]!.slimmedBytes).toBeGreaterThan(90_000);
    const target = path.join(acRoot, "content", "cars_off", "test_car");
    expect(fs.existsSync(path.join(target, "data.acd"))).toBe(true);
    expect(fs.existsSync(path.join(target, "collider.kn5"))).toBe(true);
    expect(fs.existsSync(path.join(target, "test_car.kn5"))).toBe(false);
    expect(fs.readdirSync(path.join(target, "skins", "red"))).toEqual(["preview.jpg"]);
  });

  async function uploadBytes(fileName: string, bytes: Buffer) {
    const mods = await import("../src/modules/mods/service.js");
    const created = await mods.createUpload(fileName, bytes.length);
    await mods.writeChunk(created.id, 0, Readable.from(bytes));
    await mods.completeUpload(created.id);
    let upload = await mods.getUpload(created.id);
    for (let i = 0; i < 100 && upload.status === "extracting"; i++) {
      await new Promise((r) => setTimeout(r, 100));
      upload = await mods.getUpload(created.id);
    }
    return upload;
  }

  function pyZip(file: string, script: string) {
    execFileSync("python3", ["-c", `import zipfile, io\nz=zipfile.ZipFile(${JSON.stringify(file)},'w')\n${script}\nz.close()`]);
  }

  const carZip = (name: string) =>
    `b=io.BytesIO(); i=zipfile.ZipFile(b,'w'); i.writestr('${name}/data.acd','x'); i.writestr('${name}/ui/ui_car.json','{"name":"${name}"}'); i.close()`;

  it("expands nested archives and flags duplicates", async () => {
    const file = path.join(tmpDir(), "pack.zip");
    pyZip(
      file,
      [
        carZip("car_a"), "z.writestr('Cars/car_a_v1.zip', b.getvalue())",
        carZip("car_b"), "z.writestr('Cars/car_b_v1.zip', b.getvalue())",
        carZip("car_a"), "z.writestr('Cars/car_a_copy.zip', b.getvalue())",
      ].join("\n"),
    );
    const upload = await uploadBytes("pack.zip", fs.readFileSync(file));
    expect(upload.status).toBe("ready");
    expect(upload.items.map((i) => [i.id, i.duplicate, i.source])).toEqual([
      ["car_a", false, "Cars/car_a_copy"],
      ["car_a", true, "Cars/car_a_v1"],
      ["car_b", false, "Cars/car_b_v1"],
    ]);
  });

  it("keeps archives that belong to a car (CSP extension zips) untouched", async () => {
    const file = path.join(tmpDir(), "csp-pack.zip");
    pyZip(
      file,
      [
        "f=io.BytesIO(); g=zipfile.ZipFile(f,'w'); g.writestr('font.ttf','x'); g.close()",
        "b=io.BytesIO(); i=zipfile.ZipFile(b,'w'); i.writestr('csp_car/data.acd','x'); i.writestr('csp_car/extension/fonts.zip', f.getvalue()); i.close()",
        "z.writestr('Cars/csp_car_v1.zip', b.getvalue())",
      ].join("\n"),
    );
    const upload = await uploadBytes("csp-pack.zip", fs.readFileSync(file));
    expect(upload.status).toBe("ready");
    const mods = await import("../src/modules/mods/service.js");
    await mods.installUpload(upload.id, [{ key: upload.items[0]!.key, overwrite: false }], false);
    const ext = path.join(acRoot, "content", "cars_off", "csp_car", "extension");
    expect(fs.readdirSync(ext)).toEqual(["fonts.zip"]);
  });

  it("rejects a malicious archive nested inside a pack", async () => {
    const file = path.join(tmpDir(), "evil-pack.zip");
    pyZip(file, ["b=io.BytesIO(); i=zipfile.ZipFile(b,'w'); i.writestr('../../escape.txt','x'); i.close()", "z.writestr('Cars/evil.zip', b.getvalue())", carZip("car_ok"), "z.writestr('Cars/ok.zip', b.getvalue())"].join("\n"));
    const upload = await uploadBytes("evil-pack.zip", fs.readFileSync(file));
    expect(upload.status).toBe("failed");
    expect(upload.error).toMatch(/evil\.zip.*unsafe path/);
  });

  it("rejects archives nested more than two levels deep", async () => {
    const file = path.join(tmpDir(), "deep.zip");
    pyZip(
      file,
      [
        carZip("deep_car"),
        "b2=io.BytesIO(); j=zipfile.ZipFile(b2,'w'); j.writestr('l2/car.zip', b.getvalue()); j.close()",
        "b3=io.BytesIO(); k=zipfile.ZipFile(b3,'w'); k.writestr('l1/inner.zip', b2.getvalue()); k.close()",
        "z.writestr('top/outer.zip', b3.getvalue())",
      ].join("\n"),
    );
    const upload = await uploadBytes("deep.zip", fs.readFileSync(file));
    expect(upload.status).toBe("failed");
    expect(upload.error).toMatch(/deeper than 2 levels/);
  });

  it("rejects an oversized chunk", async () => {
    const mods = await import("../src/modules/mods/service.js");
    const created = await mods.createUpload("a.zip", 5);
    await expect(mods.writeChunk(created.id, 0, Readable.from(Buffer.alloc(10)))).rejects.toThrow(/larger than expected/);
  });
});
