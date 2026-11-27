import { config } from "../../config.js";
import { HttpError, exists } from "../../core/fsutil.js";
import { backupFiles } from "../../core/serverCfg.js";
import { type JsonSchema, parseYaml, readSchema, readYaml, validateAgainst, writeYaml } from "../../core/yamlFile.js";
import { writeAtomic } from "../../core/fsutil.js";

export type FieldType = "boolean" | "integer" | "number" | "string";
export type FieldValue = boolean | number | string | null;

export interface FieldInfo {
  key: string;
  type: FieldType;
  nullable: boolean;
  description: string;
  default: FieldValue | undefined;
  enum: string[] | null;
}

const SCALAR_TYPES = new Set<FieldType>(["boolean", "integer", "number", "string"]);

function resolveRef(schema: JsonSchema, prop: JsonSchema): JsonSchema {
  const ref = (prop.$ref as string | undefined) ?? ((prop.oneOf as JsonSchema[] | undefined)?.find((x) => x.$ref)?.$ref as string | undefined);
  if (!ref?.startsWith("#/definitions/")) return prop;
  const def = (schema.definitions as Record<string, JsonSchema> | undefined)?.[ref.slice("#/definitions/".length)];
  return def ? { ...def, ...prop } : prop;
}

export function scalarFields(schema: JsonSchema | null): FieldInfo[] {
  if (!schema) return [];
  const props = (schema.properties ?? {}) as Record<string, JsonSchema>;
  const fields: FieldInfo[] = [];
  for (const [key, raw] of Object.entries(props)) {
    const prop = resolveRef(schema, raw);
    const types = ([] as string[]).concat((prop.type as string | string[] | undefined) ?? []);
    const enumValues = Array.isArray(prop.enum) ? prop.enum.filter((v): v is string => typeof v === "string") : null;
    const main = (types.find((t) => t !== "null") ?? (enumValues ? "string" : undefined)) as FieldType | undefined;
    if (!main || !SCALAR_TYPES.has(main)) continue;
    fields.push({
      key,
      type: main,
      nullable: types.includes("null"),
      description: String(raw.description ?? prop.description ?? ""),
      default: prop.default as FieldValue | undefined,
      enum: enumValues?.length ? enumValues : null,
    });
  }
  return fields;
}

async function requireExtraCfg(): Promise<void> {
  if (!(await exists(config.extraCfg))) throw new HttpError(409, "cfg/extra_cfg.yml does not exist");
}

export async function getExtraConfig() {
  await requireExtraCfg();
  const [{ text, doc }, schema] = await Promise.all([readYaml(config.extraCfg), readSchema(config.extraCfgSchema)]);
  const fields = scalarFields(schema);
  const data = (doc.toJS() ?? {}) as Record<string, unknown>;
  const values = Object.fromEntries(fields.map((f) => [f.key, (data[f.key] ?? null) as FieldValue]));
  return { yaml: text, fields, values, hasSchema: schema !== null };
}

function coerce(field: FieldInfo, value: FieldValue): FieldValue {
  if (value === null || value === "") {
    if (field.nullable || field.type === "string") return field.type === "string" && !field.nullable ? "" : null;
    throw new HttpError(400, `${field.key} cannot be empty`);
  }
  switch (field.type) {
    case "boolean":
      if (typeof value !== "boolean") throw new HttpError(400, `${field.key} must be true or false`);
      return value;
    case "integer":
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n) || (field.type === "integer" && !Number.isInteger(n))) {
        throw new HttpError(400, `${field.key} must be ${field.type === "integer" ? "an integer" : "a number"}`);
      }
      return n;
    }
    case "string":
      if (field.enum && !field.enum.includes(String(value))) throw new HttpError(400, `${field.key} has an invalid value`);
      return String(value);
  }
}

export async function updateExtraValues(values: Record<string, FieldValue>) {
  await requireExtraCfg();
  const schema = await readSchema(config.extraCfgSchema);
  const fields = new Map(scalarFields(schema).map((f) => [f.key, f]));
  const { doc } = await readYaml(config.extraCfg);
  for (const [key, value] of Object.entries(values)) {
    const field = fields.get(key);
    if (!field) throw new HttpError(400, `Unknown or non-editable field: ${key}`);
    doc.set(key, coerce(field, value));
  }
  validateAgainst(schema, doc);
  const backup = await backupFiles([config.extraCfg]);
  await writeYaml(config.extraCfg, doc);
  return { backup };
}

export async function saveExtraRaw(yamlText: string) {
  await requireExtraCfg();
  const doc = parseYaml(yamlText);
  validateAgainst(await readSchema(config.extraCfgSchema), doc);
  const backup = await backupFiles([config.extraCfg]);
  await writeAtomic(config.extraCfg, yamlText.endsWith("\n") ? yamlText : `${yamlText}\n`);
  return { backup };
}
