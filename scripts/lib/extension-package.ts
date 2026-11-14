/**
 * Paquet ZIP de l'extension (P8) : le contenu d'une construction de production (`npm run build`), plus les
 * avis de licence des données tierces qu'elle embarque.
 *
 * Le ZIP est écrit sans dépendance (zlib de Node) et il est reproductible : entrées triées, date fixe.
 */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  data: Buffer;
}

/** Date DOS fixe (1980-01-01 00:00) : deux paquets du même contenu sont identiques octet pour octet. */
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
/** Bit 11 : noms en UTF-8. */
const UTF8 = 0x0800;

/** Archive ZIP (méthode deflate, ou stockage si la compression n'aide pas). */
export function createZip(entries: readonly ZipEntry[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBytes = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    const stored = deflated.length >= data.length;
    const body = stored ? data : deflated;
    const crc = crc32(data);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(UTF8, 6);
    header.writeUInt16LE(stored ? 0 : 8, 8);
    header.writeUInt16LE(DOS_TIME, 10);
    header.writeUInt16LE(DOS_DATE, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(body.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(nameBytes.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, nameBytes, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(UTF8, 8);
    entry.writeUInt16LE(stored ? 0 : 8, 10);
    entry.writeUInt16LE(DOS_TIME, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes);

    offset += header.length + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

/** En-tête de l'extrait de Lefff, présent dans `content.js` quand le vrai moteur est embarqué. */
export const LEFFF_MARK = 'Extrait MODIFIÉ de Lefff 3.4';

export const LEFFF_LICENSE = 'data/language-resources/lefff/LICENSE-LGPL-LR.txt';

/** Avis de licence joints au paquet, selon le moteur embarqué. */
export function licenceNotice(version: string, engine: boolean): string {
  const lines = [
    `FinEthnic — SAFINUM Éton ${version}`,
    '',
    'Extension Chrome du projet FinEthnic. Composants tiers : THIRD_PARTY.md dans le dépôt du projet.',
    '',
  ];
  if (!engine) {
    lines.push('Cette version ne contient aucun moteur de traduction ni aucune donnée linguistique tierce.', '');
    return lines.join('\n');
  }
  lines.push(
    'content.js embarque le moteur de traduction et deux données linguistiques tierces :',
    '',
    '1. Un extrait modifié de Lefff 3.4 (Lexique des formes fléchies du français).',
    '   Benoît Sagot (2010). The Lefff, a freely available and large-coverage morphological and syntactic',
    '   lexicon for French. LREC 2010.',
    '   Licence LGPL-LR : texte complet dans LICENSE-LGPL-LR.txt. L’extrait reste sous cette licence ; il est',
    '   inclus dans content.js tel quel, précédé de son avis de modification daté.',
    '',
    '2. Des formes et des gloses du Dictionnaire éton–français (D7).',
    '   Mark Van de Velde & Kisito Essele Essele, Dictionnaire éton–français, Éditions CLÉ, Yaoundé, 2022.',
    '   Licence Creative Commons Attribution – Pas d’utilisation commerciale – Partage dans les mêmes',
    '   conditions 4.0 International (CC BY-NC-SA 4.0) : https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr',
    '   content.js, qui contient ces formes, est diffusé sous la même licence : aucune utilisation commerciale.',
    '',
    'Les traductions affichées par l’extension sont des propositions non validées par un locuteur, sauf mention',
    'contraire ; elles portent un marqueur dans la page.',
    '',
  );
  return lines.join('\n');
}

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(path.join(dir, entry.name), relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

export interface PackageOptions {
  /** Racine du dépôt (licences, manifeste de référence). */
  root: string;
  /** Construction de production à empaqueter. */
  distDir: string;
  outDir: string;
  /** Marqueur des dossiers produits par build.mjs, jamais empaqueté. */
  buildMarker: string;
  /** Contrôle des constructions interdites (build.mjs). */
  findForbidden: (code: string, options: { production: boolean }) => string[];
}

export interface PackageResult {
  file: string;
  version: string;
  engine: boolean;
  entries: string[];
  bytes: number;
}

/** Vérifie que `distDir` est une construction de production, puis écrit le ZIP dans `outDir`. */
export async function packageExtension(options: PackageOptions): Promise<PackageResult> {
  const { root, distDir, outDir, buildMarker } = options;
  if (!existsSync(path.join(distDir, buildMarker))) {
    throw new Error(`${distDir} n'est pas une construction de build.mjs : lancez d'abord npm run build`);
  }
  const manifestText = await readFile(path.join(distDir, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText) as { version?: unknown };
  const reference = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')) as unknown;
  if (JSON.stringify(manifest) !== JSON.stringify(reference)) {
    throw new Error(`${distDir} n'est pas une construction de production (manifeste différent de manifest.json) : lancez npm run build`);
  }
  const version = typeof manifest.version === 'string' ? manifest.version : '0.0.0';

  const files = (await listFiles(distDir)).filter((file) => file !== buildMarker).sort();
  const entries: ZipEntry[] = [];
  let engine = false;
  for (const name of files) {
    const data = await readFile(path.join(distDir, name));
    if (name.endsWith('.js')) {
      const code = data.toString('utf8');
      const forbidden = options.findForbidden(code, { production: true });
      if (forbidden.length > 0) throw new Error(`${name} contient des constructions interdites en production : ${forbidden.join(', ')}`);
      if (code.includes(LEFFF_MARK)) engine = true;
    }
    entries.push({ name, data });
  }
  entries.push({ name: 'LICENCES.txt', data: Buffer.from(licenceNotice(version, engine), 'utf8') });
  if (engine) entries.push({ name: 'LICENSE-LGPL-LR.txt', data: await readFile(path.join(root, LEFFF_LICENSE)) });

  const zip = createZip(entries);
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `finethnic-safinum-eton-${version}${engine ? '' : '-sans-moteur'}.zip`);
  await writeFile(file, zip);
  return { file, version, engine, entries: entries.map((entry) => entry.name), bytes: zip.length };
}
