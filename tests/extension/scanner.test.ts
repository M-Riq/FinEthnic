// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { contextOf, detectStep, isLive, readPageContext, roleOf } from '../../src/content/context';
import { classifyText, scanTexts, type TextKind } from '../../src/content/scanner';
import { isInExcludedRegion } from '../../src/protection/dom-guard';
import { d8Texts, loadFixture, showStep } from './support/page';

const scan = (root: Node = document.body) => {
  const found: Array<{ node: Text; kind: TextKind }> = [];
  scanTexts(root, (node, kind) => found.push({ node, kind }));
  return found;
};
const candidates = (root?: Node) => scan(root).filter((t) => t.kind === 'candidate').map((t) => t.node.data.trim());

/** Q8 non tranchée : `select` et `option` restent exclus (exception documentée de T-DET-01). */
const EXCLUDED_BY_Q8 = new Set(['P3-8']);

describe('classement des textes (P2.3)', () => {
  it.each([
    ['Frais de transfert', 'candidate'],
    ['25 000 FCFA', 'candidate'],
    ['Ọ̀kɛ́', 'candidate'],
    ['250 000', 'numeric-like'],
    ['+237 6 99 12 34 56', 'numeric-like'],
    ['05/11/2026', 'numeric-like'],
    ['   ', null],
    ['\u00A0', null],
    ['—', null],
    ['', null],
  ] as const)('%j → %s', (text, kind) => {
    expect(classifyText(text)).toBe(kind);
  });
});

describe('T-DET-01 — tous les textes D8 de la page de test sont détectés', () => {
  for (const page of [1, 2, 3, 4, 5]) {
    it(`page ${page}`, () => {
      loadFixture(document, page);
      const found = new Set(candidates());
      for (const { id, text } of d8Texts(page)) {
        if (EXCLUDED_BY_Q8.has(id)) expect(found, id).not.toContain(text);
        else expect(found, id).toContain(text);
      }
    });
  }

  it('ne lit pas les gabarits, les champs ni le titre du document', () => {
    loadFixture(document, 3);
    const found = candidates();
    expect(found).not.toContain('Jean-Paul Mbarga'); // valeur d'un input
    expect(found).not.toContain('Loyer de novembre'); // contenu d'un textarea
    expect(found.filter((text) => text === 'Votre compte')).toEqual([]); // gabarit de l'étape 1
    expect(found.some((text) => text.includes('SAFINUM Pay (page de test locale)'))).toBe(false);
  });

  it('classe à part les valeurs faites de chiffres sans lettre', () => {
    loadFixture(document, 4);
    const numeric = scan().filter((t) => t.kind === 'numeric-like').map((t) => t.node.data.trim());
    expect(numeric).toEqual(['+237 6 99 12 34 56']);
    expect(candidates()).toContain('25 000 FCFA');
  });
});

describe('T-DET-04 — régions exclues (garde DOM, P2.2)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <p id="ok">Texte visible</p>
      <script>Texte script</script><style>.x{}</style><noscript>Texte noscript</noscript>
      <template><p>Texte gabarit</p></template>
      <code>Texte code</code><pre>Texte pre</pre><kbd>Texte kbd</kbd><samp>Texte samp</samp>
      <svg><text>Texte svg</text></svg><math><mi>Texte math</mi></math>
      <textarea>Texte textarea</textarea><select><option>Texte option</option></select>
      <button>Texte bouton</button>
      <div contenteditable="true"><p>Texte éditable</p></div>
      <div contenteditable=""><p>Texte éditable vide</p></div>
      <div contenteditable="FALSE"><p>Texte non éditable</p></div>
      <div hidden><p>Texte masqué</p></div>
      <div aria-hidden="TRUE"><p>Texte aria-hidden</p></div>
      <div aria-hidden="false"><p>Texte aria-visible</p></div>`;
  });

  it('ne garde que les textes hors des régions exclues', () => {
    expect(candidates()).toEqual(['Texte visible', 'Texte bouton', 'Texte non éditable', 'Texte aria-visible']);
  });

  it('ne donne rien pour une racine située dans une région exclue', () => {
    const hidden = document.querySelector('[hidden] p')!;
    expect(scan(hidden)).toEqual([]);
    expect(scan(hidden.firstChild!)).toEqual([]);
    expect(isInExcludedRegion(document.querySelector('textarea')!.firstChild!)).toBe(true);
    expect(isInExcludedRegion(document.createTextNode('détaché'))).toBe(true);
  });

  it('accepte un nœud texte comme racine', () => {
    const text = document.getElementById('ok')!.firstChild!;
    expect(scan(text).map((t) => t.node)).toEqual([text]);
  });
});

describe('contexte d’un texte (P2.8, contrat §6)', () => {
  const textOf = (selector: string) => {
    const element = document.querySelector(selector);
    const walker = document.createTreeWalker(element!, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) if ((node as Text).data.trim()) return node as Text;
    throw new Error(selector);
  };

  it('déduit le rôle de l’élément sémantique le plus proche', () => {
    loadFixture(document, 1);
    expect(roleOf(textOf('h1').parentElement)).toBe('heading');
    expect(roleOf(textOf('button').parentElement)).toBe('button');
    expect(roleOf(textOf('a').parentElement)).toBe('link');
    expect(roleOf(textOf('dt').parentElement)).toBe('label');
    expect(roleOf(textOf('[role="status"]').parentElement)).toBe('status');
    expect(roleOf(textOf('main > p:nth-of-type(2)').parentElement)).toBe('message');
    expect(roleOf(textOf('li').parentElement)).toBe('unknown');
    expect(roleOf(null)).toBe('unknown');
  });

  it('signale les régions annoncées (alerte, statut, aria-live)', () => {
    loadFixture(document, 3);
    expect(isLive(textOf('[role="alert"]').parentElement)).toBe(true);
    expect(isLive(textOf('h1').parentElement)).toBe(false);
    showStep(document, 5);
    expect(contextOf(textOf('[role="status"]'), readPageContext(document))).toEqual({
      role: 'status',
      live: true,
      pageLang: 'fr',
      step: 5,
    });
  });

  it('reconnaît l’étape par son seul titre visible de niveau 1', () => {
    for (const step of [1, 2, 3, 4, 5] as const) {
      loadFixture(document, step);
      expect(detectStep(document)).toBe(step);
    }
    // Deux titres d'étapes différentes, ou aucun : étape inconnue (jamais déduite de l'URL).
    document.getElementById('app')!.insertAdjacentHTML('beforeend', '<h1>Récapitulatif</h1>');
    expect(detectStep(document)).toBeUndefined();
    document.querySelector('h1:last-of-type')!.setAttribute('hidden', '');
    expect(detectStep(document)).toBe(5);
    document.body.innerHTML = '<h1>Autre page</h1>';
    expect(readPageContext(document)).toEqual({ pageLang: 'fr' });
  });
});
