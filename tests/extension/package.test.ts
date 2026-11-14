import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUILD_MARKER, buildExtension, findForbidden, ROOT } from '../../build.mjs';
import { createZip, LEFFF_MARK, packageExtension } from '../../scripts/lib/extension-package';

/** Lecteur ZIP minimal : répertoire central, puis données locales (stockées ou deflate). */
function readZip(zip: Buffer): Map<string, Buffer> {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(at + 10);
    const size = zip.readUInt32LE(at + 20);
    const nameLength = zip.readUInt16LE(at + 28);
    const name = zip.toString('utf8', at + 46, at + 46 + nameLength);
    const local = zip.readUInt32LE(at + 42);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const body = zip.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(body) : Buffer.from(body));
    at += 46 + nameLength;
  }
  return files;
}

let work: string;
let prod: string;
beforeAll(async () => {
  work = await mkdtemp(path.join(tmpdir(), 'finethnic-package-'));
  prod = path.join(work, 'prod');
  await buildExtension({ dev: false, outDir: prod, engine: 'none' });
});
afterAll(() => rm(work, { recursive: true, force: true }));

const pack = (distDir: string) =>
  packageExtension({ root: ROOT, distDir, outDir: path.join(work, 'release'), buildMarker: BUILD_MARKER, findForbidden });

describe('paquet ZIP de l’extension (P8)', () => {
  it('écrit un ZIP lisible et reproductible, noms UTF-8 compris', () => {
    const entries = [
      { name: 'manifest.json', data: Buffer.from('{"a":1}') },
      { name: 'popup/éton.txt', data: Buffer.from('ŋ'.repeat(500)) },
      { name: 'vide.txt', data: Buffer.alloc(0) },
    ];
    const zip = createZip(entries);
    expect(createZip(entries).equals(zip)).toBe(true);
    expect(readZip(zip)).toEqual(new Map(entries.map(({ name, data }) => [name, data])));
  });

  it('empaquette une construction de production sans moteur, sans le marqueur de construction', async () => {
    const result = await pack(prod);
    expect(result).toMatchObject({ version: '0.1.0', engine: false });
    expect(path.basename(result.file)).toBe('finethnic-safinum-eton-0.1.0-sans-moteur.zip');
    const files = readZip(await readFile(result.file));
    expect([...files.keys()]).toEqual(result.entries);
    expect(files.has(BUILD_MARKER)).toBe(false);
    expect(files.has('LICENSE-LGPL-LR.txt')).toBe(false);
    expect(files.get('manifest.json')?.toString()).toBe(await readFile(path.join(prod, 'manifest.json'), 'utf8'));
    expect(files.get('LICENCES.txt')?.toString()).toContain('aucun moteur de traduction');
  });

  it('joint les avis Lefff (LGPL-LR) et D7 (CC BY-NC-SA 4.0) quand le moteur est embarqué', async () => {
    const withEngine = path.join(work, 'engine');
    await cp(prod, withEngine, { recursive: true });
    const content = path.join(withEngine, 'content.js');
    await writeFile(content, `const lexicon = "# ${LEFFF_MARK} — licence LGPL-LR";\n${await readFile(content, 'utf8')}`);
    const result = await pack(withEngine);
    expect(result.engine).toBe(true);
    const files = readZip(await readFile(result.file));
    expect(files.get('LICENSE-LGPL-LR.txt')?.toString()).toContain('Lesser General Public License');
    const notice = files.get('LICENCES.txt')?.toString() ?? '';
    expect(notice).toContain('Benoît Sagot');
    expect(notice).toContain('Van de Velde');
    expect(notice).toContain('CC BY-NC-SA 4.0');
  });

  it('refuse une construction de développement, un dossier quelconque et du code interdit', async () => {
    const dev = path.join(work, 'dev');
    await buildExtension({ dev: true, outDir: dev, engine: 'fake' });
    await expect(pack(dev)).rejects.toThrow('pas une construction de production');
    await expect(pack(path.join(ROOT, 'docs'))).rejects.toThrow("n'est pas une construction de build.mjs");

    const tampered = path.join(work, 'tampered');
    await cp(prod, tampered, { recursive: true });
    await writeFile(path.join(tampered, 'popup', 'popup.js'), 'fetch("https://exemple.org")');
    await expect(pack(tampered)).rejects.toThrow('fetch()');
  });
});
