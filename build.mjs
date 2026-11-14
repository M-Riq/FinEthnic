// @ts-check
/**
 * Construction de l'extension (P1.1).
 *
 *   node build.mjs              → dist/      (production : manifest.json, sans journal ni faux moteur)
 *   node build.mjs --dev        → dist-dev/  (développement : manifest.dev.json, journal actif)
 *   node build.mjs --out <dir>  → autre dossier de sortie (tests)
 *
 * Le code produit est vérifié **avant** d'être écrit : la construction échoue s'il contient un accès
 * réseau, une évaluation de code, une injection HTML ou, en production, le faux moteur (contrat §9).
 */
import { build } from 'esbuild';
import { copyFile, lstat, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
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
 * @returns {{ dev: boolean, outDir: string }}
 */
export function parseArgs(argv) {
  let dev = false;
  /** @type {string | undefined} */
  let out;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dev') dev = true;
    else if (arg === '--out' && argv[i + 1]) out = argv[++i];
    else throw new Error(`Argument inconnu : ${arg}`);
  }
  return { dev, outDir: path.resolve(ROOT, out ?? (dev ? 'dist-dev' : 'dist')) };
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

/**
 * @param {{ dev: boolean, outDir: string }} options
 * @returns {Promise<string[]>} fichiers écrits, relatifs au dossier de sortie
 */
export async function buildExtension({ dev, outDir }) {
  await assertSafeOutDir(outDir);

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

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const files = await buildExtension(options);
    const sizes = await Promise.all(files.map(async (f) => (await stat(path.join(options.outDir, f))).size));
    console.log(`Extension construite (${options.dev ? 'développement' : 'production'}) → ${path.relative(ROOT, options.outDir) || '.'}`);
    files.forEach((f, i) => console.log(`  ${f} (${sizes[i]} o)`));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
