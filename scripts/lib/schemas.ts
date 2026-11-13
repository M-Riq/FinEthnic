import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';

const SCHEMA_DIR = fileURLToPath(new URL('../../data/schemas/', import.meta.url));
const SCHEMA_BASE = 'https://finethnic.example/schemas/';

export const SCHEMA_NAMES = ['entry', 'lexicon', 'review-import'] as const;
export type SchemaName = (typeof SCHEMA_NAMES)[number];

export type SchemaValidators = Record<SchemaName, ValidateFunction>;

/** Charge les schémas de data/schemas/ dans une instance Ajv stricte (draft 2020-12). */
export function loadSchemaValidators(): SchemaValidators {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const name of SCHEMA_NAMES) {
    ajv.addSchema(JSON.parse(readFileSync(`${SCHEMA_DIR}${name}.schema.json`, 'utf8')));
  }
  const get = (name: SchemaName): ValidateFunction => {
    const validate = ajv.getSchema(`${SCHEMA_BASE}${name}.schema.json`);
    if (!validate) throw new Error(`Schéma introuvable : ${name}`);
    return validate;
  };
  return { entry: get('entry'), lexicon: get('lexicon'), 'review-import': get('review-import') };
}

export function formatSchemaErrors(errors: readonly ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((e) => {
    const extra = e.keyword === 'additionalProperties' ? ` (${String(e.params['additionalProperty'])})` : '';
    return `${e.instancePath || '/'} : ${e.message ?? e.keyword}${extra}`;
  });
}
