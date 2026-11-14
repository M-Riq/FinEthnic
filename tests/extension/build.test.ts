import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUILD_MARKER, buildExtension, engineChoice, findForbidden, parseArgs, ROOT } from '../../build.mjs';
import { DICTIONARY_PATH } from '../../scripts/lib/engine-d7';

const HAS_D7 = existsSync(path.join(ROOT, DICTIONARY_PATH));

describe('findForbidden', () => {
  it('refuse le réseau, l’évaluation de code et l’injection HTML, en production comme en développement', () => {
    const samples = [
      'fetch("https://x")',
      'new XMLHttpRequest()',
      'new WebSocket(u)',
      'new EventSource(u)',
      'navigator.sendBeacon(u)',
      'eval(code)',
      '(0, eval)(code)',
      'new Function("x")',
      'Function("return this")()',
      'setTimeout("alert(1)", 0)',
      'import("https://x/y.js")',
      'el.innerHTML = t',
      'el.outerHTML = t',
      'el.insertAdjacentHTML("beforeend", t)',
      'document.write(t)',
    ];
    for (const code of samples) {
      expect(findForbidden(code, { production: false }), code).toHaveLength(1);
      expect(findForbidden(code, { production: true }), code).toHaveLength(1);
    }
  });

  it('refuse le faux moteur en production seulement (contrat §9)', () => {
    for (const code of ['"⟦FAKE⟧ "', '"\\u27E6FAKE\\u27E7"', '"\\u{27e6}FAKE"', 'engineId: "fake"', "{engineId:'fake'}", 'class A { engineId = "fake"; }']) {
      expect(findForbidden(code, { production: true }), code).toHaveLength(1);
      expect(findForbidden(code, { production: false }), code).toEqual([]);
    }
  });

  it('accepte le code ordinaire de l’extension', () => {
    const code =
      'node.data = text; const prefetch = 1; engineId: "local-v1"; refetch(); el.textContent = t; isFunction(f); evaluate(); setTimeout(cb, 0);';
    expect(findForbidden(code, { production: true })).toEqual([]);
  });
});

describe('parseArgs', () => {
  it('choisit dist/ et le vrai moteur en production, dist-dev/ et le faux moteur en développement', () => {
    expect(parseArgs([])).toEqual({ dev: false, outDir: path.join(ROOT, 'dist'), engine: 'real' });
    expect(parseArgs(['--dev'])).toEqual({ dev: true, outDir: path.join(ROOT, 'dist-dev'), engine: 'fake' });
    expect(parseArgs(['--out', '/tmp/x'])).toEqual({ dev: false, outDir: '/tmp/x', engine: 'real' });
    expect(parseArgs(['--engine', 'none'])).toEqual({ dev: false, outDir: path.join(ROOT, 'dist'), engine: 'none' });
    expect(parseArgs(['--dev', '--engine', 'real']).engine).toBe('real');
    expect(() => parseArgs(['--prod'])).toThrow('Argument inconnu');
  });

  it('refuse le faux moteur en production et un moteur inconnu (contrat §9)', () => {
    expect(() => parseArgs(['--engine', 'fake'])).toThrow('réservé au développement');
    expect(() => engineChoice({ dev: false, outDir: '/tmp/x', engine: 'fake' })).toThrow('réservé au développement');
    expect(() => parseArgs(['--dev', '--engine', 'mot'])).toThrow('Moteur inconnu');
  });
});

describe('buildExtension', () => {
  let tmp: string;
  beforeAll(async () => {
    tmp = await mkdtemp(path.join(tmpdir(), 'finethnic-build-'));
  });
  afterAll(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  const EXPECTED_FILES = [
    'content.css',
    'content.js',
    'icons/icon-128.png',
    'icons/icon-16.png',
    'icons/icon-32.png',
    'icons/icon-48.png',
    'manifest.json',
    'popup/popup.css',
    'popup/popup.html',
    'popup/popup.js',
  ];

  it('produit une extension de production complète, sans journal ni carte des sources', async () => {
    const out = path.join(tmp, 'prod');
    expect(await buildExtension({ dev: false, outDir: out, engine: 'none' })).toEqual(EXPECTED_FILES);

    const manifest = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8'));
    expect(manifest).toEqual(JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8')));

    // Tous les fichiers cités par le manifest et par le popup existent dans la sortie.
    const referenced = [
      ...manifest.content_scripts.flatMap((s: { js: string[]; css: string[] }) => [...s.js, ...s.css]),
      manifest.action.default_popup,
      ...Object.values<string>(manifest.icons),
      ...Object.values<string>(manifest.action.default_icon),
      'popup/popup.js',
      'popup/popup.css',
    ];
    for (const file of referenced) expect(EXPECTED_FILES).toContain(file);
    await expect(readFile(path.join(out, BUILD_MARKER), 'utf8')).resolves.toContain('build.mjs');

    for (const file of ['content.js', 'popup/popup.js']) {
      const code = await readFile(path.join(out, file), 'utf8');
      expect(code).not.toContain('__FINETHNIC_DEV__');
      expect(code).not.toContain('__FINETHNIC_ENGINE');
      expect(code).not.toContain('sourceMappingURL');
      expect(findForbidden(code, { production: true })).toEqual([]);
    }
    // Sans moteur, aucun moteur ni ressource n'est embarqué.
    const content = await readFile(path.join(out, 'content.js'), 'utf8');
    expect(content).not.toContain('parseLexicon');
    expect(content.length).toBeLessThan(200_000);
  });

  it.skipIf(!HAS_D7)('embarque le vrai moteur et ses ressources en production (BM7, D7 importé)', async () => {
    const out = path.join(tmp, 'prod-real');
    expect(await buildExtension({ dev: false, outDir: out })).toEqual(EXPECTED_FILES);
    const content = await readFile(path.join(out, 'content.js'), 'utf8');
    expect(findForbidden(content, { production: true })).toEqual([]);
    expect(content).toContain('engineId: "finethnic"');
    expect(content).not.toContain('__FINETHNIC_ENGINE');
    expect(content).not.toContain('sourceMappingURL');
  });

  it.skipIf(HAS_D7)('refuse le vrai moteur sans D7, avec la commande à lancer', async () => {
    await expect(buildExtension({ dev: false, outDir: path.join(tmp, 'sans-d7') })).rejects.toThrow('npm run import-dictionary');
  });

  it('produit une extension de développement avec le manifest localhost', async () => {
    const out = path.join(tmp, 'dev');
    expect(await buildExtension({ dev: true, outDir: out })).toEqual(EXPECTED_FILES);
    const manifest = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8'));
    expect(manifest.content_scripts[0].matches).toContain('http://localhost/*');
    // Le faux moteur n'est présent qu'ici ; la règle de production le refuserait.
    const content = await readFile(path.join(out, 'content.js'), 'utf8');
    expect(findForbidden(content, { production: true })).toEqual(
      expect.arrayContaining(['marqueur ⟦FAKE⟧', "engineId 'fake'"]),
    );
  });

  it('remplace une construction précédente', async () => {
    const out = path.join(tmp, 'prod');
    await writeFile(path.join(out, 'ancien.js'), '');
    await buildExtension({ dev: false, outDir: out, engine: 'none' });
    await expect(readFile(path.join(out, 'ancien.js'))).rejects.toThrow();
  });

  it('refuse de vider le dépôt, un dossier parent, un fichier ou un dossier qui n’est pas une construction', async () => {
    await expect(buildExtension({ dev: false, outDir: ROOT, engine: 'none' })).rejects.toThrow('contient le dépôt');
    await expect(buildExtension({ dev: false, outDir: path.dirname(ROOT), engine: 'none' })).rejects.toThrow('contient le dépôt');

    const file = path.join(tmp, 'fichier.txt');
    await writeFile(file, 'à garder');
    await expect(buildExtension({ dev: false, outDir: file, engine: 'none' })).rejects.toThrow('pas un dossier');
    await expect(readFile(file, 'utf8')).resolves.toBe('à garder');

    // Un dossier d'extension quelconque (avec manifest.json) n'est pas une construction de build.mjs.
    const other = path.join(tmp, 'autre');
    await buildExtension({ dev: false, outDir: other, engine: 'none' });
    await rm(path.join(other, BUILD_MARKER));
    await expect(buildExtension({ dev: false, outDir: other, engine: 'none' })).rejects.toThrow(`sans ${BUILD_MARKER}`);
    await expect(readFile(path.join(other, 'manifest.json'))).resolves.toBeDefined();
  });
});
