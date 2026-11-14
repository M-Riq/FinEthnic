import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const runCli = (...dirs: string[]) =>
  spawnSync(process.execPath, ['--import', 'tsx', 'scripts/validate-data.ts', ...dirs], { cwd: ROOT, encoding: 'utf8' });

describe('npm run validate-data (ligne de commande)', () => {
  it('réussit sur les fixtures valides', () => {
    const r = runCli('tests/language/fixtures/entries');
    expect(r.stderr).toBe('');
    expect(r.stdout).toContain('1 fichier(s), 7 entrée(s), 0 problème(s).');
    expect(r.status).toBe(0);
  });

  it('échoue sur un dossier mal orthographié au lieu de réussir sans rien valider', () => {
    const r = runCli('data/financal-corpus');
    expect(r.stderr).toContain('dossier introuvable');
    expect(r.status).toBe(1);
  });
});
