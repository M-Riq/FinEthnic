/**
 * Ressources du vrai moteur embarquées dans l'extension (BM7).
 *
 * `build.mjs --engine real` lit les ressources sur le poste qui construit (D8 et Lefff versionnés, D7 hors
 * Git, Q17), les sérialise avec `serializeResources` et les injecte dans le bundle sous forme de deux
 * chaînes. Le script de contenu les relit avec `reviveResources` : aucune requête, aucun fichier lu.
 *
 * Le lexique Lefff voyage en texte brut et est analysé dans la page par `parseLexicon`, comme dans les
 * scripts : ses lectures sont celles du moteur, à l'identique. Les `Map` et `Set` (traductions validées,
 * rejets) sont encodés à part, car JSON ne les connaît pas.
 */
import type { ContractResources } from '../engine/contract-engine';
import { parseLexicon } from '../engine/lexicon';

/** Ressources prêtes à injecter : `data` (JSON) et `lexicon` (texte Lefff). */
export interface SerializedResources {
  data: string;
  lexicon: string;
}

const MAP_TAG = '$finethnicMap';
const SET_TAG = '$finethnicSet';

/**
 * Sérialise les ressources du moteur, hors lexique (fourni en texte brut). Lève une erreur si une valeur ne
 * survivrait pas à JSON (fonction, `undefined` dans une liste, nombre non fini) : le moteur embarqué doit
 * recevoir exactement les ressources des scripts.
 */
export function serializeResources(resources: ContractResources, lexiconText: string): SerializedResources {
  const { lexicon: _lexicon, ...rest } = resources;
  const data = JSON.stringify(rest, (key, value: unknown) => {
    if (value instanceof Map) return { [MAP_TAG]: [...value.entries()] };
    if (value instanceof Set) return { [SET_TAG]: [...value.values()] };
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
      throw new Error(`Ressource du moteur non sérialisable : « ${key} » (${typeof value})`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`Ressource du moteur non sérialisable : « ${key} » (${String(value)})`);
    }
    if (Array.isArray(value) && value.includes(undefined)) {
      throw new Error(`Ressource du moteur non sérialisable : « ${key} » contient undefined`);
    }
    return value;
  });
  return { data, lexicon: lexiconText };
}

/** Inverse de `serializeResources`. */
export function reviveResources({ data, lexicon }: SerializedResources): ContractResources {
  const rest = JSON.parse(data, (_key, value: unknown) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value);
      if (keys.length === 1 && keys[0] === MAP_TAG) return new Map((value as Record<string, [unknown, unknown][]>)[MAP_TAG]);
      if (keys.length === 1 && keys[0] === SET_TAG) return new Set((value as Record<string, unknown[]>)[SET_TAG]);
    }
    return value;
  }) as Omit<ContractResources, 'lexicon'>;
  return { ...rest, lexicon: parseLexicon(lexicon) };
}
