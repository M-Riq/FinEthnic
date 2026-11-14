/**
 * Ressources du moteur embarquées (phase 4) : textes produits par `scripts/export-engine-data.ts` et
 * intégrés au bundle par `build.mjs`. Seul `index.ts` importe ce module (les tests passent leurs ressources).
 */
import lefff from '../../build/engine-data/lefff.data';
import resources from '../../build/engine-data/resources.data';

export const ENGINE_DATA = { resources, lefff } as const;
