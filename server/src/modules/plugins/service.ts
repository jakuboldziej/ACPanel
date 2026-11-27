import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../../config.js";
import { HttpError, exists, listDirs } from "../../core/fsutil.js";
import { backupFiles } from "../../core/serverCfg.js";
import { parseYaml, readSchema, readYaml, stringifyYaml, validateAgainst, writeYaml } from "../../core/yamlFile.js";
import { writeAtomic } from "../../core/fsutil.js";

const PLUGIN_NAME = /^[A-Za-z0-9_]+$/;

export interface PluginInfo {
  name: string;
  installed: boolean;
  enabled: boolean;
  configFile: string | null;
  configExists: boolean;
  referenceExists: boolean;
  schemaExists: boolean;
}

function assertPluginName(name: string): void {
  if (!PLUGIN_NAME.test(name)) throw new HttpError(400, `Invalid plugin name: ${name}`);
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function snake(name: string): string {
  return name
    .replace(/Plugin$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();
}

async function listNames(dir: string, pattern: RegExp): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  for (const f of files) {
    const m = pattern.exec(f);
    if (m) out.set(normalize(m[1]!), m[1]!);
  }
  return out;
}

interface ConfigFiles {
  configs: Map<string, string>;
  references: Map<string, string>;
  schemas: Map<string, string>;
}

async function scanConfigFiles(): Promise<ConfigFiles> {
  const [configs, references, schemas] = await Promise.all([
    listNames(config.cfgDir, /^plugin_(.+)_cfg\.yml$/),
    listNames(path.join(config.cfgDir, "reference"), /^plugin_(.+)_cfg\.reference\.yml$/),
    listNames(path.join(config.cfgDir, "schemas"), /^plugin_(.+)_cfg\.schema\.json$/),
  ]);
  return { configs, references, schemas };
}

function configBase(name: string, files: ConfigFiles): string {
  const key = normalize(name.replace(/Plugin$/, ""));
  return files.configs.get(key) ?? files.references.get(key) ?? files.schemas.get(key) ?? snake(name);
}

export function pluginPaths(base: string) {
  return {
    config: path.join(config.cfgDir, `plugin_${base}_cfg.yml`),
    reference: path.join(config.cfgDir, "reference", `plugin_${base}_cfg.reference.yml`),
    schema: path.join(config.cfgDir, "schemas", `plugin_${base}_cfg.schema.json`),
  };
}

export async function getEnabledPlugins(): Promise<string[]> {
  if (!(await exists(config.extraCfg))) return [];
  const { doc } = await readYaml(config.extraCfg);
  const v = doc.toJS()?.EnablePlugins as unknown;
  return Array.isArray(v) ? v.map(String) : [];
}

export async function listPlugins(): Promise<{ plugins: PluginInfo[]; extraCfgExists: boolean }> {
  const [dirs, enabled, files, extraCfgExists] = await Promise.all([
    listDirs(config.pluginsDir),
    getEnabledPlugins(),
    scanConfigFiles(),
    exists(config.extraCfg),
  ]);
  const installed = new Set<string>();
  for (const d of dirs) {
    if (!d.empty && (await exists(path.join(config.pluginsDir, d.name, `${d.name}.dll`)))) installed.add(d.name);
  }
  const names = [...new Set([...installed, ...enabled])].sort((a, b) => a.localeCompare(b));
  const enabledSet = new Set(enabled);
  const plugins = names.map((name): PluginInfo => {
    const key = normalize(name.replace(/Plugin$/, ""));
    const base = configBase(name, files);
    return {
      name,
      installed: installed.has(name),
      enabled: enabledSet.has(name),
      configFile: `plugin_${base}_cfg.yml`,
      configExists: files.configs.has(key),
      referenceExists: files.references.has(key),
      schemaExists: files.schemas.has(key),
    };
  });
  return { plugins, extraCfgExists };
}

export async function setEnabledPlugins(names: string[]): Promise<{ backup: string; enabled: string[] }> {
  names.forEach(assertPluginName);
  if (!(await exists(config.extraCfg))) throw new HttpError(409, "cfg/extra_cfg.yml does not exist");
  const { plugins } = await listPlugins();
  const installed = new Set(plugins.filter((p) => p.installed).map((p) => p.name));
  for (const n of names) if (!installed.has(n)) throw new HttpError(400, `Plugin ${n} is not installed`);

  const unique = [...new Set(names)];
  const { doc } = await readYaml(config.extraCfg);
  doc.set("EnablePlugins", unique.length ? unique : null);
  validateAgainst(await readSchema(config.extraCfgSchema), doc);
  const backup = await backupFiles([config.extraCfg]);
  await writeYaml(config.extraCfg, doc);
  return { backup, enabled: unique };
}

async function resolvePlugin(name: string) {
  assertPluginName(name);
  const { plugins } = await listPlugins();
  const plugin = plugins.find((p) => p.name === name);
  if (!plugin) throw new HttpError(404, `No such plugin: ${name}`);
  const base = plugin.configFile!.replace(/^plugin_/, "").replace(/_cfg\.yml$/, "");
  return { plugin, paths: pluginPaths(base) };
}

async function readOptional(file: string): Promise<string | null> {
  return fs.readFile(file, "utf8").catch(() => null);
}

export async function getPluginConfig(name: string) {
  const { plugin, paths } = await resolvePlugin(name);
  const [yaml, reference] = await Promise.all([readOptional(paths.config), readOptional(paths.reference)]);
  return {
    name,
    file: plugin.configFile,
    exists: yaml !== null,
    yaml: yaml ?? "",
    reference,
    hasSchema: plugin.schemaExists,
  };
}

export async function savePluginConfig(name: string, yamlText: string) {
  const { paths } = await resolvePlugin(name);
  const doc = parseYaml(yamlText);
  validateAgainst(await readSchema(paths.schema), doc);
  const backup = (await exists(paths.config)) ? await backupFiles([paths.config]) : null;
  await writeAtomic(paths.config, yamlText.endsWith("\n") ? yamlText : `${yamlText}\n`);
  return { backup, normalized: stringifyYaml(doc) !== yamlText };
}

export async function createPluginConfigFromReference(name: string) {
  const { paths } = await resolvePlugin(name);
  if (await exists(paths.config)) throw new HttpError(409, "Config file already exists");
  const reference = await readOptional(paths.reference);
  if (reference === null) {
    throw new HttpError(409, "No reference file yet. Enable the plugin and restart the server to generate it");
  }
  await writeAtomic(paths.config, reference);
  return getPluginConfig(name);
}
