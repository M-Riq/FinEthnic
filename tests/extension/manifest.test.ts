import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));

const prod = read('manifest.json');
const dev = read('manifest.dev.json');

const SAFINUM = 'https://safinum.cm/hackathon-test*';

describe('manifest de production — instantané de sécurité (P1.2, T-INS)', () => {
  it('n’a que les clés attendues : ni host_permissions, ni service worker, ni ressource exposée', () => {
    expect(Object.keys(prod).sort()).toEqual([
      'action',
      'content_scripts',
      'description',
      'icons',
      'manifest_version',
      'minimum_chrome_version',
      'name',
      'permissions',
      'short_name',
      'version',
    ]);
    expect(prod['manifest_version']).toBe(3);
  });

  it('ne demande que la permission storage', () => {
    expect(prod['permissions']).toEqual(['storage']);
  });

  it('n’injecte le script de contenu que sur l’environnement de test, dans le cadre principal', () => {
    expect(prod['content_scripts']).toEqual([
      { matches: [SAFINUM], js: ['content.js'], css: ['content.css'], run_at: 'document_idle', all_frames: false },
    ]);
  });

  it('a une description dans la limite du Chrome Web Store', () => {
    expect(String(prod['description']).length).toBeLessThanOrEqual(132);
  });
});

describe('manifest de développement (P1.3)', () => {
  it('est identique à la production, sauf le nom et l’ajout de localhost', () => {
    const { name, content_scripts: devScripts, ...devRest } = dev;
    const { name: prodName, content_scripts: prodScripts, ...prodRest } = prod;
    expect(devRest).toEqual(prodRest);
    expect(name).toBe(`${String(prodName)} (développement)`);

    const [devScript] = devScripts as Array<Record<string, unknown>>;
    const [prodScript] = prodScripts as Array<Record<string, unknown>>;
    expect({ ...devScript, matches: prodScript?.['matches'] }).toEqual(prodScript);
    expect(devScript?.['matches']).toEqual([SAFINUM, 'http://localhost/*', 'http://127.0.0.1/*']);
  });
});
