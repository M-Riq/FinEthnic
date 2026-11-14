import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEFFF_SOURCE, selectLefff, wordsOf } from '../../scripts/lib/lefff-subset';
import { LEXICON_PATH } from '../engine/support';

describe('extrait de Lefff (moteur, PR 2)', () => {
  const lefff = [
    'envoie\tv\tenvoyer\tPS13s', 'enverrons\tv\tenvoyer\tF1p', 'envoyé\tnc\tenvoyé\tms',
    'banane\tnc\tbanane\tfs', '!\tponcts\t!\t', "l'\tdet\tle\ts", 'les\tdet\tle\tp',
  ];

  it('garde les formes du vocabulaire et toutes les formes de leurs lemmes, sans la ponctuation', () => {
    const { kept, lemmas, missing } = selectLefff(lefff, wordsOf("Il envoie l'argent ! Zut"));
    expect(kept).toEqual(['envoie\tv\tenvoyer\tPS13s', 'enverrons\tv\tenvoyer\tF1p', "l'\tdet\tle\ts", 'les\tdet\tle\tp']);
    expect(lemmas).toBe(2);
    expect(missing).toEqual(['argent', 'il', 'zut']);
  });

  it('l’extrait versionné porte l’avis de modification LGPL-LR et la licence l’accompagne', () => {
    const header = readFileSync(LEXICON_PATH, 'utf8').split('\n').filter((l) => l.startsWith('#')).join('\n');
    expect(header).toContain('Extrait MODIFIÉ de Lefff 3.4 — licence LGPL-LR');
    expect(header).toContain(LEFFF_SOURCE.sha256);
    expect(header).toMatch(/Modifié le \d{4}-\d{2}-\d{2}/u);
    expect(existsSync(new URL('LICENSE-LGPL-LR.txt', LEXICON_PATH))).toBe(true);
  });
});
