import type { SessionsConfig, Weather } from "./api";

export const WEATHER_TYPES = [
  "1_heavy_fog",
  "2_light_fog",
  "3_clear",
  "4_mid_clear",
  "5_light_clouds",
  "6_mid_clouds",
  "7_heavy_clouds",
];

export const GRIP_PRESETS: { name: string; v: SessionsConfig["dynamicTrack"] }[] = [
  { name: "Dusty", v: { enabled: true, sessionStart: 86, randomness: 1, sessionTransfer: 50, lapGain: 30 } },
  { name: "Old", v: { enabled: true, sessionStart: 89, randomness: 3, sessionTransfer: 80, lapGain: 50 } },
  { name: "Slow", v: { enabled: true, sessionStart: 96, randomness: 1, sessionTransfer: 80, lapGain: 300 } },
  { name: "Green", v: { enabled: true, sessionStart: 95, randomness: 2, sessionTransfer: 90, lapGain: 132 } },
  { name: "Fast", v: { enabled: true, sessionStart: 98, randomness: 2, sessionTransfer: 80, lapGain: 700 } },
  { name: "Optimum", v: { enabled: true, sessionStart: 100, randomness: 0, sessionTransfer: 100, lapGain: 1 } },
];

export const NEW_WEATHER: Weather = {
  graphics: "3_clear",
  ambient: 20,
  road: 7,
  variationAmbient: 1,
  variationRoad: 1,
  windMin: 0,
  windMax: 0,
  windDirection: 0,
  windDirectionVariation: 0,
};
