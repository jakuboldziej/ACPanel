import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dev-ac");
if (fs.existsSync(root) && !process.argv.includes("--force")) {
  console.log(`${root} already exists (use --force to overwrite)`);
  process.exit(0);
}
fs.rmSync(root, { recursive: true, force: true });

const w = (p, s) => {
  fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
  fs.writeFileSync(path.join(root, p), s);
};

const on = ["bmw_m3_e30", "ks_mazda_mx5_cup", "ks_ferrari_488_gt3"];
const off = ["abarth500", "ks_nissan_skyline_r34", "ks_porsche_911_gt3_rs", "ks_mclaren_650_gt3"];
for (const c of on) w(`content/cars/${c}/data.acd`, "x");
for (const c of off) w(`content/cars_off/${c}/data.acd`, "x");
w("content/cars_off/abarth500/ui/ui_car.json", '{ "name": "Abarth 500 EsseEsse" }');
fs.mkdirSync(path.join(root, "content/cars_off/ks_empty_placeholder"), { recursive: true });

w("content/tracks/ks_nordschleife/ui/nordschleife/ui_track.json", '{ "name": "Nordschleife", "pitboxes": "24" }');
w("content/tracks/magione/ui/ui_track.json", '{ "name": "Magione", "pitboxes": "10" }');

w(
  "cfg/server_cfg.ini",
  [
    "[SERVER]",
    "NAME=Dev Server",
    `CARS=${on.join(";")}`,
    "CONFIG_TRACK=nordschleife",
    "TRACK=ks_nordschleife",
    "MAX_CLIENTS=9",
    "",
    "[PRACTICE]",
    "NAME=Practice",
    "TIME=60",
    "",
  ].join("\r\n"),
);
w("cfg/entry_list.ini", "");
console.log(`Done: ${root}`);
