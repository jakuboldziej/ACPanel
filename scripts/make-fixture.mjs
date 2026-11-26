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

for (const l of ["nordschleife", "endurance", "touristenfahrten"]) w(`content/tracks/ks_nordschleife/${l}/data/surfaces.ini`, "");
w("content/tracks/ks_nordschleife/ui/nordschleife/ui_track.json", '{ "name": "Nordschleife", "pitboxes": "24" }');
w("content/tracks/ks_nordschleife/ui/endurance/ui_track.json", '{ "name": "Nordschleife Endurance", "pitboxes": "4" }');
w("content/tracks/ks_nordschleife/ui/touristenfahrten/ui_track.json", '{ "name": "Nordschleife - Tourist", "pitboxes": "32" }');
w("content/tracks/magione/data/surfaces.ini", "");
w("content/tracks/magione/ui/ui_track.json", '{ "name": "Magione", "pitboxes": "10" }');
for (const l of ["club_circuit", "extended_circuit"]) w(`content/tracks/ks_vallelunga/${l}/data/surfaces.ini`, "");
w("content/tracks/drift/data/surfaces.ini", "");
fs.mkdirSync(path.join(root, "content/tracks/ks_barcelona"), { recursive: true });

for (const p of ["VotingWeatherPlugin", "AutoModerationPlugin", "GeoIPPlugin", "RandomWeatherPlugin"]) {
  w(`plugins/${p}/${p}.dll`, "x");
}

w(
  "cfg/extra_cfg.yml",
  [
    "# Override minimum CSP version required to join this server. Leave this empty to not require CSP.",
    "MinimumCSPVersion: 2651",
    "# Force headlights on for all cars",
    "ForceLights: false",
    "# Enable AI traffic",
    "EnableAi: false",
    "# List of plugins to enable",
    "EnablePlugins: ",
    "# Server description shown in Content Manager",
    "ServerDescription: ''",
    "# Radius around a player in which other cars are sent with full rate",
    "NetworkBubbleDistance: 500",
    "",
  ].join("\n"),
);

w(
  "cfg/schemas/extra_cfg.schema.json",
  JSON.stringify(
    {
      $schema: "http://json-schema.org/draft-04/schema#",
      type: "object",
      additionalProperties: false,
      properties: {
        MinimumCSPVersion: { type: ["integer", "null"], description: "Minimum CSP version required to join", default: 2651 },
        ForceLights: { type: "boolean", description: "Force headlights on for all cars", default: false },
        EnableAi: { type: "boolean", description: "Enable AI traffic", default: false },
        EnablePlugins: { type: ["array", "null"], description: "List of plugins to enable", items: { type: "string" } },
        ServerDescription: { type: ["null", "string"], description: "Server description shown in Content Manager" },
        NetworkBubbleDistance: { type: "number", description: "Radius around a player with full update rate", default: 500 },
      },
    },
    null,
    2,
  ),
);

w(
  "cfg/reference/plugin_voting_weather_cfg.reference.yml",
  ["# Number of choices players can choose from at each voting interval", "NumChoices: 3", "# How long the vote stays open", "VotingDurationSeconds: 30", ""].join("\n"),
);
w(
  "cfg/schemas/plugin_voting_weather_cfg.schema.json",
  JSON.stringify({
    $schema: "http://json-schema.org/draft-04/schema#",
    type: "object",
    additionalProperties: false,
    properties: { NumChoices: { type: "integer" }, VotingDurationSeconds: { type: "integer" } },
  }),
);

w("cfg/data_track_params.ini", ["[ks_nordschleife]", "[magione]", "[ks_vallelunga]", ""].join("\r\n"));

w(
  "cfg/server_cfg.ini",
  [
    "[SERVER]",
    "NAME=Dev Server",
    `CARS=${on.join(";")}`,
    "CONFIG_TRACK=nordschleife",
    "TRACK=ks_nordschleife",
    "MAX_CLIENTS=9",
    "SUN_ANGLE=16",
    "ALLOWED_TYRES_OUT=2",
    "",
    "[PRACTICE]",
    "NAME=Practice",
    "TIME=60",
    "IS_OPEN=1",
    "",
    "[QUALIFY]",
    "NAME=Qualify",
    "TIME=10",
    "IS_OPEN=1",
    "",
    "[RACE]",
    "NAME=Race",
    "LAPS=5",
    "WAIT_TIME=60",
    "IS_OPEN=1",
    "",
    "[DYNAMIC_TRACK]",
    "SESSION_START=95",
    "RANDOMNESS=2",
    "SESSION_TRANSFER=90",
    "LAP_GAIN=10",
    "",
    "[WEATHER_0]",
    "GRAPHICS=3_clear",
    "BASE_TEMPERATURE_AMBIENT=22",
    "BASE_TEMPERATURE_ROAD=8",
    "VARIATION_AMBIENT=1",
    "VARIATION_ROAD=1",
    "",
  ].join("\r\n"),
);
w(
  "cfg/entry_list.ini",
  on
    .flatMap((model, i) => [0, 1, 2].map((k) => ({ model, n: i * 3 + k })))
    .map(({ model, n }) => `[CAR_${n}]\r\nMODEL=${model}\r\nSKIN=\r\nSPECTATOR_MODE=0\r\nDRIVERNAME=\r\nTEAM=\r\nGUID=\r\nBALLAST=0\r\nRESTRICTOR=0\r\n`)
    .join("\r\n"),
);
console.log(`Done: ${root}`);
