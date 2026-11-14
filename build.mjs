// @ts-check
/**
 * Construction de l'extension (P1.1).
 *
 *   node build.mjs              → dist/      (production : manifest.json, sans journal ni faux moteur)
 *   node build.mjs --dev        → dist-dev/  (développement : manifest.dev.json, journal actif)
 *   node build.mjs --out <dir>  → autre dossier de sortie (tests)
 *   node build.mjs --zip        → dist/ puis release/finethnic-<version>.zip (paquet à distribuer)
 *
 * Le code produit est vérifié **avant** d'être écrit : la construction échoue s'il contient un accès
 * réseau, une évaluation de code, une injection HTML ou, en production, le faux moteur (contrat §9).
 *
 * Phase 4 : les ressources du moteur (D7, D8, règles de grammaire, extrait de Lefff) sont d'abord
 * exportées dans `build/engine-data/` (`scripts/export-engine-data.ts`), puis intégrées comme texte au
 * script de contenu : le moteur tourne dans la page, sans aucun chargement réseau.
 *
 * Phase 5 : `--zip` construit la version de production puis l'archive (`zipDirectory`), manifest à la
 * racine, licences des données dans `licences/`. L'archive est reproductible : ordre trié, date fixe.
 */
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { copyFile, lstat, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));

/** @typedef {{ label: string, pattern: RegExp }} ForbiddenRule */

/** @type {readonly ForbiddenRule[]} */
const ALWAYS_FORBIDDEN = [
  { label: 'fetch()', pattern: /\bfetch\s*\(/ },
  { label: 'XMLHttpRequest', pattern: /\bXMLHttpRequest\b/ },
  { label: 'WebSocket', pattern: /\bWebSocket\b/ },
  { label: 'EventSource', pattern: /\bEventSource\b/ },
  { label: 'sendBeacon', pattern: /\bsendBeacon\b/ },
  { label: 'importScripts', pattern: /\bimportScripts\b/ },
  { label: 'import() dynamique', pattern: /\bimport\s*\(/ },
  // Couvre eval(…), (0, eval)(…) et window.eval.
  { label: 'eval', pattern: /\beval\b/ },
  // Couvre new Function(…) et Function(…).
  { label: 'Function()', pattern: /\bFunction\s*\(/ },
  { label: 'setTimeout/setInterval avec une chaîne', pattern: /\bset(?:Timeout|Interval)\s*\(\s*["'`]/ },
  { label: 'innerHTML / outerHTML', pattern: /\.(?:inner|outer)HTML\b/ },
  { label: 'insertAdjacentHTML', pattern: /\binsertAdjacentHTML\b/ },
  { label: 'document.write', pattern: /\bdocument\.write(?:ln)?\b/ },
];

/** @type {readonly ForbiddenRule[]} */
const PRODUCTION_FORBIDDEN = [
  { label: 'marqueur ⟦FAKE⟧', pattern: /(?:\u27E6|\\u27e6|\\u\{27e6\})\s*FAKE/i },
  { label: "engineId 'fake'", pattern: /\bengineId\s*[:=]\s*["'`]fake/ },
];

/**
 * Liste les constructions interdites trouvées dans du code produit.
 * @param {string} code
 * @param {{ production: boolean }} options
 * @returns {string[]}
 */
export function findForbidden(code, { production }) {
  const rules = production ? [...ALWAYS_FORBIDDEN, ...PRODUCTION_FORBIDDEN] : ALWAYS_FORBIDDEN;
  return rules.filter(({ pattern }) => pattern.test(code)).map(({ label }) => label);
}

/**
 * @param {readonly string[]} argv
 * @returns {{ dev: boolean, outDir: string, zip: boolean }}
 */
export function parseArgs(argv) {
  let dev = false;
  let zip = false;
  /** @type {string | undefined} */
  let out;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dev') dev = true;
    else if (arg === '--zip') zip = true;
    else if (arg === '--out' && argv[i + 1]) out = argv[++i];
    else throw new Error(`Argument inconnu : ${arg}`);
  }
  if (dev && zip) throw new Error('--zip refusé avec --dev : seule la version de production se distribue');
  return { dev, outDir: path.resolve(ROOT, out ?? (dev ? 'dist-dev' : 'dist')), zip };
}

/** Fichier témoin écrit dans chaque construction : seul un dossier qui le contient peut être vidé. */
export const BUILD_MARKER = '.finethnic-build';

/**
 * Refuse de vider autre chose qu'un dossier absent, vide ou issu d'une construction précédente.
 * @param {string} outDir
 */
async function assertSafeOutDir(outDir) {
  const rel = path.relative(outDir, ROOT);
  if (rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))) {
    throw new Error(`Dossier de sortie refusé (il contient le dépôt) : ${outDir}`);
  }
  /** @type {import('node:fs').Stats} */
  let info;
  try {
    info = await lstat(outDir);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return;
    throw error;
  }
  if (!info.isDirectory()) {
    throw new Error(`Dossier de sortie refusé (ce n'est pas un dossier) : ${outDir}`);
  }
  const entries = await readdir(outDir);
  if (entries.length > 0 && !entries.includes(BUILD_MARKER)) {
    throw new Error(`Dossier de sortie refusé (non vide et sans ${BUILD_MARKER}) : ${outDir}`);
  }
}

/** Exporte les ressources du moteur (TypeScript, lancé avec tsx). */
function exportEngineData() {
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/export-engine-data.ts'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'] });
}

/**
 * @param {{ dev: boolean, outDir: string }} options
 * @returns {Promise<string[]>} fichiers écrits, relatifs au dossier de sortie
 */

export async function buildExtension({ dev, outDir }) {
  await assertSafeOutDir(outDir);
  exportEngineData();

  const result = await build({
    absWorkingDir: ROOT,
    entryPoints: {
      content: 'src/content/index.ts',
      'popup/popup': 'src/popup/index.ts',
    },
    outdir: outDir,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome110'],
    charset: 'utf8',
    // Élimine le code mort (journal, faux moteur) sans rendre le code illisible pour la relecture.
    minifySyntax: true,
    sourcemap: dev ? 'inline' : false,
    define: { __FINETHNIC_DEV__: dev ? 'true' : 'false' },
    // Ressources du moteur (build/engine-data/*.data), intégrées comme chaînes.
    loader: { '.data': 'text' },
    write: false,
    logLevel: 'warning',
  });

  const problems = result.outputFiles.flatMap((file) =>
    findForbidden(file.text, { production: !dev }).map((label) => `${path.relative(outDir, file.path)} : ${label}`),
  );
  if (problems.length > 0) {
    throw new Error(`Construction refusée, code interdit :\n  ${problems.join('\n  ')}`);
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, BUILD_MARKER), 'Dossier produit par build.mjs : il est vidé à chaque construction.\n');
  /** @type {Array<[string, string]>} [source relative au dépôt, destination relative à outDir] */
  const copies = [
    [dev ? 'manifest.dev.json' : 'manifest.json', 'manifest.json'],
    ['src/content/content.css', 'content.css'],
    ['src/popup/popup.html', 'popup/popup.html'],
    ['src/popup/popup.css', 'popup/popup.css'],
    // Licences des données embarquées : D7 (CC BY-NC-SA 4.0, attribution obligatoire) et Lefff (LGPL-LR).
    ['data/language-resources/d7/LICENCE.md', 'licences/D7-LICENCE.md'],
    ['data/language-resources/lefff/README.md', 'licences/LEFFF.md'],
    ['data/language-resources/lefff/LICENSE-LGPL-LR.txt', 'licences/LEFFF-LICENSE-LGPL-LR.txt'],
    ...(await readdir(path.join(ROOT, 'icons')))
      .filter((name) => name.endsWith('.png'))
      .map((name) => /** @type {[string, string]} */ ([`icons/${name}`, `icons/${name}`])),
  ];

  /** @type {string[]} */
  const written = [];
  for (const file of result.outputFiles) {
    await mkdir(path.dirname(file.path), { recursive: true });
    await writeFile(file.path, file.contents);
    written.push(path.relative(outDir, file.path));
  }
  for (const [from, to] of copies) {
    const target = path.join(outDir, to);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(ROOT, from), target);
    written.push(to);
  }
  return written.map((f) => f.split(path.sep).join('/')).sort();
}

/** @type {Uint32Array} */
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/** @param {Uint8Array} data */
function crc32(data) {
  let c = 0xffffffff;
  for (const byte of data) c = /** @type {number} */ (CRC_TABLE[(c ^ byte) & 0xff]) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Date DOS fixe (1er janvier 1980, 00:00) : même contenu, même archive. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/**
 * Archive ZIP (méthode « deflate », noms UTF-8) de `files`, chemins relatifs avec « / ».
 * @param {ReadonlyArray<{ name: string, data: Uint8Array }>} files
 * @returns {Buffer}
 */
export function zipFiles(files) {
  /** @type {Buffer[]} */
  const locals = [];
  /** @type {Buffer[]} */
  const centrals = [];
  let offset = 0;
  for (const { name, data } of [...files].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const nameBytes = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, packed);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/**
 * Archive les fichiers d'une construction (`files`, relatifs à `outDir`) dans `release/`.
 * @param {string} outDir
 * @param {readonly string[]} files
 * @returns {Promise<string>} chemin de l'archive
 */
export async function packageExtension(outDir, files) {
  const manifest = JSON.parse(await readFile(path.join(outDir, 'manifest.json'), 'utf8'));
  const entries = await Promise.all(files.map(async (name) => ({ name, data: await readFile(path.join(outDir, name)) })));
  const target = path.join(ROOT, 'release', `finethnic-${manifest.version}.zip`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, zipFiles(entries));
  return target;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const files = await buildExtension(options);
    const sizes = await Promise.all(files.map(async (f) => (await stat(path.join(options.outDir, f))).size));
    console.log(`Extension construite (${options.dev ? 'développement' : 'production'}) → ${path.relative(ROOT, options.outDir) || '.'}`);
    files.forEach((f, i) => console.log(`  ${f} (${sizes[i]} o)`));
    if (options.zip) {
      const zip = await packageExtension(options.outDir, files);
      console.log(`Paquet → ${path.relative(ROOT, zip)} (${(await stat(zip)).size} o)`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
