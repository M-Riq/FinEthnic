import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inflateRawSync } from 'node:zlib';
import { BUILD_MARKER, buildExtension, findForbidden, parseArgs, ROOT, zipFiles } from '../../build.mjs';

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
  it('choisit dist/ en production et dist-dev/ en développement', () => {
    expect(parseArgs([])).toEqual({ dev: false, outDir: path.join(ROOT, 'dist'), zip: false });
    expect(parseArgs(['--dev'])).toEqual({ dev: true, outDir: path.join(ROOT, 'dist-dev'), zip: false });
    expect(parseArgs(['--out', '/tmp/x'])).toEqual({ dev: false, outDir: '/tmp/x', zip: false });
    expect(parseArgs(['--zip'])).toEqual({ dev: false, outDir: path.join(ROOT, 'dist'), zip: true });
    expect(() => parseArgs(['--prod'])).toThrow('Argument inconnu');
    expect(() => parseArgs(['--dev', '--zip'])).toThrow('production');
  });
});

/** Lit une archive ZIP par son répertoire central : nom → contenu décompressé. */
function unzip(zip: Buffer): Map<string, Buffer> {
  const end = zip.length - 22;
  expect(zip.readUInt32LE(end)).toBe(0x06054b50);
  const files = new Map<string, Buffer>();
  let at = zip.readUInt32LE(end + 16);
  for (let i = 0; i < zip.readUInt16LE(end + 10); i++) {
    expect(zip.readUInt32LE(at)).toBe(0x02014b50);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    const local = zip.readUInt32LE(at + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    files.set(name, inflateRawSync(zip.subarray(start, start + size)));
    at += 46 + nameLength;
  }
  return files;
}

describe('zipFiles', () => {
  it('archive les fichiers à l’identique, dans un ordre fixe, de façon reproductible', () => {
    const files = [
      { name: 'popup/popup.html', data: Buffer.from('<p>Éton : mbəmbə</p>') },
      { name: 'manifest.json', data: Buffer.from('{"manifest_version":3}') },
    ];
    const zip = zipFiles(files);
    expect(zipFiles([...files].reverse()).equals(zip)).toBe(true);
    const back = unzip(zip);
    expect([...back.keys()]).toEqual(['manifest.json', 'popup/popup.html']);
    for (const { name, data } of files) expect(back.get(name)?.equals(data)).toBe(true);
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
    'licences/D7-LICENCE.md',
    'licences/LEFFF-LICENSE-LGPL-LR.txt',
    'licences/LEFFF.md',
    'manifest.json',
    'popup/popup.css',
    'popup/popup.html',
    'popup/popup.js',
  ];

  it('produit une extension de production complète, sans journal ni carte des sources', async () => {
    const out = path.join(tmp, 'prod');
    expect(await buildExtension({ dev: false, outDir: out })).toEqual(EXPECTED_FILES);

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
      expect(code).not.toContain('sourceMappingURL');
      expect(findForbidden(code, { production: true })).toEqual([]);
    }
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
    await buildExtension({ dev: false, outDir: out });
    await expect(readFile(path.join(out, 'ancien.js'))).rejects.toThrow();
  });

  it('refuse de vider le dépôt, un dossier parent, un fichier ou un dossier qui n’est pas une construction', async () => {
    await expect(buildExtension({ dev: false, outDir: ROOT })).rejects.toThrow('contient le dépôt');
    await expect(buildExtension({ dev: false, outDir: path.dirname(ROOT) })).rejects.toThrow('contient le dépôt');

    const file = path.join(tmp, 'fichier.txt');
    await writeFile(file, 'à garder');
    await expect(buildExtension({ dev: false, outDir: file })).rejects.toThrow('pas un dossier');
    await expect(readFile(file, 'utf8')).resolves.toBe('à garder');

    // Un dossier d'extension quelconque (avec manifest.json) n'est pas une construction de build.mjs.
    const other = path.join(tmp, 'autre');
    await buildExtension({ dev: false, outDir: other });
    await rm(path.join(other, BUILD_MARKER));
    await expect(buildExtension({ dev: false, outDir: other })).rejects.toThrow(`sans ${BUILD_MARKER}`);
    await expect(readFile(path.join(other, 'manifest.json'))).resolves.toBeDefined();
  });
});
