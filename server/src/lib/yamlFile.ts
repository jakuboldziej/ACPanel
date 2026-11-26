import fs from "node:fs/promises";
import AjvModule, { type ErrorObject } from "ajv-draft-04";
import { type Document, isMap, isScalar, isSeq, parseDocument } from "yaml";
import { HttpError, writeAtomic } from "./fsutil.js";

const STRINGIFY = { nullStr: "", lineWidth: 0 } as const;

function moveNullValueComments(node: unknown): void {
  if (isMap(node)) {
    node.items.forEach((pair, i) => {
      const value = pair.value;
      const next = node.items[i + 1];
      if (isScalar(value) && value.value === null && value.comment && next && isScalar(next.key)) {
        next.key.commentBefore = next.key.commentBefore ? `${value.comment}\n${next.key.commentBefore}` : value.comment;
        value.comment = undefined;
        next.key.spaceBefore = false;
      }
      moveNullValueComments(pair.value);
    });
  } else if (isSeq(node)) {
    node.items.forEach(moveNullValueComments);
  }
}

export function parseYaml(text: string): Document {
  const doc = parseDocument(text);
  if (doc.errors.length) {
    const e = doc.errors[0]!;
    const line = e.linePos?.[0]?.line;
    throw new HttpError(400, `YAML error${line ? ` on line ${line}` : ""}: ${e.message.split("\n")[0]}`);
  }
  moveNullValueComments(doc.contents);
  return doc;
}

export async function readYaml(file: string): Promise<{ text: string; doc: Document }> {
  const text = await fs.readFile(file, "utf8");
  return { text, doc: parseYaml(text) };
}

export function stringifyYaml(doc: Document): string {
  return doc.toString(STRINGIFY);
}

export async function writeYaml(file: string, doc: Document): Promise<void> {
  await writeAtomic(file, stringifyYaml(doc));
}

export type JsonSchema = Record<string, unknown>;

export async function readSchema(file: string): Promise<JsonSchema | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as JsonSchema;
  } catch {
    return null;
  }
}

const Ajv = AjvModule.default;
const ajv = new Ajv({ strict: false, validateFormats: false, allErrors: true });

function formatError(e: ErrorObject): string {
  const where = e.instancePath ? e.instancePath.slice(1).replace(/\//g, ".") : "root";
  if (e.keyword === "additionalProperties") {
    return `${where}: unknown key "${(e.params as { additionalProperty: string }).additionalProperty}"`;
  }
  return `${where}: ${e.message ?? e.keyword}`;
}

export function validateAgainst(schema: JsonSchema | null, doc: Document): void {
  if (!schema) return;
  const validate = ajv.compile(schema);
  if (!validate(doc.toJS() ?? {})) {
    const errors = (validate.errors ?? []).slice(0, 10).map(formatError);
    throw new HttpError(400, `Config does not match the schema:\n${errors.join("\n")}`);
  }
}
