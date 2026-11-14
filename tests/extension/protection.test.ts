// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startContent, type ContentController } from '../../src/content/controller';
import { createFakeEngine } from '../../src/content/fake-engine';
import { startPipeline, type Pipeline } from '../../src/content/pipeline';
import type { TranslationEngine, TranslationRequest } from '../../src/language/contract';
import { indicativeTokens, isValuePosition } from '../../src/protection/dom-guard';
import { createEchoGuard, MAX_ECHOES, type EchoGuard } from '../../src/protection/echo';
import { checkIntegrity, hashText } from '../../src/protection/integrity';
import { detectProtected, protectedSpans } from '../../src/protection/patterns';
import { createSettingsStore, SETTINGS_KEY } from '../../src/shared/settings';
import { createFakeStorage } from './support/fake-storage';
import { d8Texts, frozenClock, loadFixture, manualFrames, recorder, showStep } from './support/page';

const NBSP = '\u00A0';
const NNBSP = '\u202F';
const MINUS = '\u2212';

/**
 * Cas limites de P3.1 (valeurs de D1 §5, des tests T-PRO et des pages D8) : segments attendus, dans
 * l'ordre du texte. Un montant et sa devise forment deux segments (contrat §12).
 */
const CASES: ReadonlyArray<readonly [string, readonly string[]]> = [
  // T-PRO-01 à 04 : montants, zéro, signes, espaces normales et insécables.
  ['250 000 FCFA', ['250 000', 'FCFA']],
  [`250${NBSP}000${NBSP}FCFA`, [`250${NBSP}000`, 'FCFA']],
  [`25${NNBSP}000 FCFA`, [`25${NNBSP}000`, 'FCFA']],
  ['25 000 FCFA', ['25 000', 'FCFA']],
  ['0 FCFA', ['0', 'FCFA']],
  ['+180 000 FCFA', ['+180 000', 'FCFA']],
  ['-12 500 FCFA', ['-12 500', 'FCFA']],
  [`${MINUS}12${NBSP}500 FCFA`, [`${MINUS}12${NBSP}500`, 'FCFA']],
  ['1 250,50 XAF', ['1 250,50', 'XAF']],
  ['Solde : 1 000 000,00 FCFA', ['1 000 000,00', 'FCFA']],
  ['Montant : 5 000 FCFA', ['5 000', 'FCFA']],
  ['F CFA', ['F CFA']],
  ['12,5', ['12,5']],
  ['1.234.567', ['1.234.567']],
  // Pourcentages : le nombre et le signe ensemble.
  ['Frais : 1,5 %', ['1,5 %']],
  [`Taux de 2${NNBSP}% par mois`, [`2${NNBSP}%`]],
  // T-PRO-07 : téléphones.
  ['+237 6 99 12 34 56', ['+237 6 99 12 34 56']],
  ['(+237) 699 12 34 56', ['(+237) 699 12 34 56']],
  ['00237 699123456', ['00237 699123456']],
  ['Appelez le +237 699 12 34 56.', ['+237 699 12 34 56']],
  // T-PRO-08 : comptes.
  ['CM 001 2345 6789 01', ['CM 001 2345 6789 01']],
  ['CM21 1000 5000 0123', ['CM21 1000 5000 0123']],
  // T-PRO-09 : références.
  ['SAF-2026-OTCUQ3', ['SAF-2026-OTCUQ3']],
  ['Référence : SAF-2026-OTCUQ3', ['SAF-2026-OTCUQ3']],
  ['N° 12345', ['12345']],
  // T-PRO-10 : dates et heures.
  ['05 nov. 2026', ['05 nov. 2026']],
  [`05${NBSP}nov.${NBSP}2026`, [`05${NBSP}nov.${NBSP}2026`]],
  ['05/11/2026', ['05/11/2026']],
  ['2026-11-05', ['2026-11-05']],
  ['1er novembre 2026', ['1er novembre 2026']],
  ['Nov 5, 2026', ['Nov 5, 2026']],
  ['Solde mis à jour en novembre 2026', ['novembre 2026']],
  ['à 14:30', ['14:30']],
  ['14h30', ['14h30']],
  ['Ouvert dès 9 h', ['9 h']],
  ['Payez 5 000 FCFA avant le 05/11/2026 à 14h30.', ['5 000', 'FCFA', '05/11/2026', '14h30']],
  // E-mails et URL, sans la ponctuation de la phrase.
  ['Écrivez à support@safinum.cm.', ['support@safinum.cm']],
  ['https://safinum.cm/aide?x=1.', ['https://safinum.cm/aide?x=1']],
  ['(www.safinum.cm)', ['www.safinum.cm']],
  // T-PRO-14 : marques (D5 §4.3, v0.2).
  ['Compte Safinum', ['Safinum']],
  ['Safinum Pay — environnement de test', ['Safinum Pay']],
  [`SAFINUM${NBSP}PAY`, [`SAFINUM${NBSP}PAY`]],
  // Filet de sécurité : tout jeton qui contient un chiffre.
  ['Code 4B7X', ['4B7X']],
  ['#A12', ['#A12']],
  // Faux positifs connus et acceptés (sur-protection, voir l'en-tête de patterns.ts).
  ['Étape 1 sur 5', ['1', '5']],
  ['OK 5', ['OK 5']],
  ['2 mai', ['2 mai']],
  ['Voir safinum.cm', ['safinum.cm']],
  // Rien à protéger : libellés et noms (les noms sont protégés par leur position et la liste blanche).
  ['Frais de transfert', []],
  ['Confirmer le transfert', []],
  ['Jean-Paul Mbarga', []],
  ['Amina Ngo Bell', []],
  ['Bonjour, Amina', []],
  ['Safinumx', []],
  ['', []],
];

/** Valeurs d'exemple (D1 §5) des variables du corpus D8 ; `null` : valeur protégée par sa seule position. */
const EXAMPLE_VALUES: Readonly<Record<string, string | null>> = {
  montant: '25 000',
  frais: '0',
  total: `25${NNBSP}000`,
  devise: 'FCFA',
  date: '05 nov. 2026',
  heure: '14h30',
  numéro: '+237 6 99 12 34 56',
  numéro_compte: 'CM 001 2345 6789 01',
  référence: 'SAF-2026-OTCUQ3',
  durée: null,
  nom: null,
  nom_bénéficiaire: null,
};
const PLACEHOLDER_FILLERS: Readonly<Record<string, string>> = { durée: '5 minutes', nom: 'Amina', nom_bénéficiaire: 'Jean-Paul Mbarga' };

/** Textes français du corpus D8 (bibliothèque et pages de test). */
function corpusTexts(): string[] {
  const dir = path.join(import.meta.dirname, '../../data/financial-corpus');
  const texts: string[] = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const entries = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Array<{ source: { fr: { text: string } | null } }>;
    for (const entry of entries) if (entry.source.fr) texts.push(entry.source.fr.text);
  }
  for (const page of [1, 2, 3, 4, 5]) texts.push(...d8Texts(page).map(({ text }) => text));
  return texts;
}

/** Vérifie les invariants du module sur un texte ; renvoie les segments. */
function expectWellFormed(text: string): readonly string[] {
  const spans = protectedSpans(text);
  for (const [i, span] of spans.entries()) {
    expect(span.end, text).toBeGreaterThan(span.start);
    if (i > 0) expect(span.start, text).toBeGreaterThan(spans[i - 1]!.end); // triés, ni chevauchement ni contact
  }
  // Tout chiffre de la page est dans un segment.
  for (const match of text.matchAll(/\p{Nd}/gu)) {
    expect(
      spans.some((span) => match.index >= span.start && match.index < span.end),
      `${JSON.stringify(text)} : chiffre non protégé à ${match.index}`,
    ).toBe(true);
  }
  // Le moteur retrouve chaque segment en cherchant à partir de la fin du précédent (contrat §8).
  const segments = detectProtected(text);
  let from = 0;
  for (const segment of segments) {
    const at = text.indexOf(segment, from);
    expect(at, `${JSON.stringify(text)} : ${JSON.stringify(segment)}`).toBeGreaterThanOrEqual(0);
    from = at + segment.length;
  }
  expect(checkIntegrity(text, text)).toBeNull();
  return segments;
}

/** Générateur pseudo-aléatoire déterministe (LCG) : le test est reproductible. */
function random(seed: number) {
  let state = seed;
  return (n: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % n;
  };
}

describe('motifs protégés (P3.1)', () => {
  it.each(CASES)('%j → %j', (text, expected) => {
    expect(detectProtected(text)).toEqual(expected);
    expectWellFormed(text);
  });

  it('accepte une entrée invalide sans lever d’erreur', () => {
    expect(detectProtected(null as unknown as string)).toEqual([]);
    expect(detectProtected(42 as unknown as string)).toEqual([]);
  });

  it('protège chaque valeur d’exemple insérée dans les gabarits du corpus D8', () => {
    let filled = 0;
    for (const template of corpusTexts().filter((text) => text.includes('{'))) {
      const text = template.replace(/\{([^}]+)\}/gu, (_, name: string) => EXAMPLE_VALUES[name] ?? PLACEHOLDER_FILLERS[name] ?? `{${name}}`);
      expect(text, template).not.toMatch(/\{/u);
      const segments = expectWellFormed(text);
      for (const name of template.matchAll(/\{([^}]+)\}/gu)) {
        const value = EXAMPLE_VALUES[name[1]!];
        if (value) expect(segments, `${template} : {${name[1]}}`).toContain(value);
      }
      filled++;
    }
    expect(filled).toBeGreaterThanOrEqual(20);
  });

  it('0 faux négatif : tous les textes D8 respectent les invariants', () => {
    const texts = corpusTexts();
    expect(texts.length).toBeGreaterThan(300);
    for (const text of texts) expectWellFormed(text);
  });

  it('respecte les invariants sur des textes tirés au hasard', () => {
    const pieces = ['5', '000', '12', ' ', NBSP, NNBSP, 'FCFA', 'XAF', 'a', 'é', 'Safinum', 'Pay', '-', '+', MINUS, ',', '.', ':', '/', '@', '(', ')', '%', 'h', 'nov.', 'CM', 'SAF', 'x', '\n', '«', '»', 'www.', 'cm'];
    const next = random(20261114);
    for (let i = 0; i < 2000; i++) {
      let text = '';
      for (let n = 1 + next(30); n > 0; n--) text += pieces[next(pieces.length)];
      expectWellFormed(text);
    }
  });

  it('reste en temps linéaire sur des entrées hostiles', () => {
    const hostile = {
      dots: 'a.'.repeat(50_000) + 'x'.repeat(50_000),
      ones: '1 '.repeat(50_000),
      digits: '1'.repeat(100_000) + 'é',
      account: 'CM ' + '1 '.repeat(50_000) + 'é',
      reference: 'SAF-' + '1-'.repeat(50_000) + 'é',
      at: '@'.repeat(100_000),
      mail: 'a'.repeat(100_000) + '@',
      phone: '+237' + ' 1'.repeat(50_000) + 'x',
      signs: '-1'.repeat(50_000),
      months: '5 nov '.repeat(20_000),
      page: 'Frais : 0 FCFA, Safinum Pay, 05 nov. 2026, +237 6 99 12 34 56. '.repeat(1_500),
    };
    for (const [name, text] of Object.entries(hostile)) {
      const started = performance.now();
      detectProtected(text);
      expect(performance.now() - started, name).toBeLessThan(1_500);
    }
  });
});

describe('positions « valeur » (P3.2, P3.3)', () => {
  /** Premier nœud texte de l'élément marqué `data-x`. */
  const marked = (id = 'x'): Text => {
    const element = document.querySelector(`[data-${id}]`)!;
    return document.createTreeWalker(element, NodeFilter.SHOW_TEXT).nextNode() as Text;
  };

  it.each([
    '<dl><div><dt>Bénéficiaire</dt><dd data-x>Jean-Paul Mbarga</dd></div></dl>',
    '<table><tr><th>Montant</th><td data-x><b>Gratuit</b></td></tr></table>',
    '<div role="row"><span role="rowheader">Frais</span><span role="cell" data-x>Offerts</span></div>',
    '<p><span>Motif :</span><span data-x>Facture</span></p>',
    '<p><output data-x>Facture</output></p>',
    '<p><time data-x datetime="2026-11-05">hier</time></p>',
    '<p><data data-x value="5">cinq</data></p>',
    '<p><a data-x href="TEL:+237699123456">Appeler l’agence</a></p>',
    '<p><a data-x href="mailto:aide@safinum.cm">Écrire au support</a></p>',
    '<p class="beneficiary-name"><span data-x>Bonheur</span></p>',
    '<p><span data-x data-testid="txRef">Facture</span></p>',
    '<p><span data-x id="nomTitulaire">Amina</span></p>',
    '<p><span data-x class="montant-débité">Gratuit</span></p>',
  ])('%s → valeur', (html) => {
    document.body.innerHTML = html;
    expect(isValuePosition(marked())).toBe(true);
  });

  it('ne protège ni les libellés, ni une ligne de plus de deux cellules, ni un lien ordinaire', () => {
    document.body.innerHTML = `
      <dl><div><dt id="dt">Bénéficiaire</dt><dd>Jean-Paul Mbarga</dd></div></dl>
      <table><tr><th id="th">Montant</th><td>5 000</td></tr><tr><td>Frais</td><td id="three">Offerts</td><td>x</td></tr></table>
      <p><span id="label">Motif :</span><span>Facture</span></p>
      <p><span>Motif</span><span id="nocolon">Facture</span></p>
      <p><a id="link" href="/aide">Aide</a></p>
      <section class="amount-panel"><h2 id="title">Montant à envoyer</h2></section>
      <p class="names"><span id="plural">Noms</span></p>`;
    for (const id of ['dt', 'th', 'three', 'label', 'nocolon', 'link', 'title', 'plural']) {
      expect(isValuePosition(document.getElementById(id)!.firstChild!), id).toBe(false);
    }
  });

  it('découpe les attributs indicatifs en mots (casse chameau, accents, séparateurs)', () => {
    expect(indicativeTokens('txRef beneficiary_name montant-débité Solde.Value')).toEqual([
      'tx', 'ref', 'beneficiary', 'name', 'montant', 'debite', 'solde', 'value',
    ]);
    // Un mot indicatif dans un mot plus long ne compte pas (« preference », « renommer »).
    document.body.innerHTML = '<p class="preference renommer"><span data-x>Préférences</span></p>';
    expect(isValuePosition(marked())).toBe(false);
  });
});

/** Moteur espion : enregistre les textes demandés et délègue au faux moteur. */
function spyEngine() {
  const fake = createFakeEngine({ detectProtected });
  const requests: TranslationRequest[] = [];
  const engine: TranslationEngine = {
    info: fake.info,
    translate: (request) => {
      requests.push(request);
      return fake.translate(request);
    },
    translateMany: (batch) => {
      requests.push(...batch);
      return fake.translateMany(batch);
    },
  };
  return { engine, requested: () => requests.map((request) => request.text.trim()) };
}

let pipeline: Pipeline | null = null;
let echo: EchoGuard | null = null;
const controllers: ContentController[] = [];
afterEach(() => {
  pipeline?.stop();
  pipeline = null;
  echo?.stop();
  echo = null;
  controllers.splice(0).forEach((controller) => controller.stop());
});

describe('T-PRO-05, T-PRO-06 — noms et cellules valeur', () => {
  it('ne soumet jamais au moteur une valeur de cellule (page de test, étapes 1, 4 et 5)', () => {
    for (const step of [1, 4, 5]) {
      const spy = spyEngine();
      loadFixture(document, step);
      pipeline = startPipeline({ doc: document, engine: spy.engine, schedule: manualFrames().schedule, logger: recorder().logger, now: frozenClock });
      for (const dd of document.querySelectorAll('dd')) expect(spy.requested(), `étape ${step}`).not.toContain(dd.textContent!.trim());
      if (step !== 1) expect(spy.requested()).not.toContain('Jean-Paul Mbarga');
      expect(pipeline.counts().values).toBeGreaterThan(0);
      pipeline.stop();
      pipeline = null;
    }
  });

  it('un nom hors structure n’est pas une entrée : rien n’est écrit, et l’intégrité exige le nom', () => {
    loadFixture(document, 1);
    const spy = spyEngine();
    pipeline = startPipeline({ doc: document, engine: spy.engine, schedule: manualFrames().schedule, logger: recorder().logger, now: frozenClock });
    const statusOf = (text: string) => [...pipeline!.entries()].find(([node]) => node.data.trim() === text)?.[1].status;
    expect(statusOf('Amina Ngo Bell')).toBe('NO_MATCH');
    // Si le moteur signale le prénom, une écriture qui le perd ou l'altère est refusée.
    expect(checkIntegrity('Bonjour, Amina', 'Mbolo, Amina', ['Amina'])).toBeNull();
    expect(checkIntegrity('Bonjour, Amina', 'Mbolo, Amena', ['Amina'])).toBe('engine-segment-missing');
  });
});

describe('T-PRO-11 — écho des valeurs saisies (P3.4)', () => {
  const form = () => {
    document.body.innerHTML = `
      <input id="note" value="">
      <textarea id="motif"></textarea>
      <select id="reason"><option value="services">Paiement de services</option><option value="rent">Loyer</option></select>
      <input id="pin" type="password">
      <input id="ok" type="checkbox" value="Facture">`;
    const field = <T extends Element>(id: string) => document.getElementById(id) as unknown as T;
    return {
      note: field<HTMLInputElement>('note'),
      motif: field<HTMLTextAreaElement>('motif'),
      reason: field<HTMLSelectElement>('reason'),
      pin: field<HTMLInputElement>('pin'),
    };
  };
  const fire = (target: Element, type: string) => target.dispatchEvent(new Event(type, { bubbles: true }));

  it('reconnaît une valeur validée, seule ou après un libellé « : »', () => {
    const { note, motif } = form();
    echo = createEchoGuard(document);
    expect(echo.isEcho('Facture')).toBe(false);
    note.value = 'Facture';
    fire(note, 'change');
    motif.value = '  Paiement   de\nservices ';
    fire(motif, 'change');
    expect(echo.isEcho('Facture')).toBe(true);
    expect(echo.isEcho('  Facture ')).toBe(true);
    expect(echo.isEcho('Note : Facture')).toBe(true);
    expect(echo.isEcho('Motif : Paiement de services')).toBe(true);
    expect(echo.isEcho('Facture électricité')).toBe(false);
    expect(echo.isEcho('Factures')).toBe(false);
  });

  it('relève les valeurs préremplies et l’option choisie, au démarrage ou au clic qui change d’étape', () => {
    const { note } = form();
    echo = createEchoGuard(document);
    expect(echo.isEcho('Paiement de services')).toBe(true); // option choisie par défaut, présente au démarrage
    expect(echo.isEcho('services')).toBe(true);
    expect(echo.isEcho('Loyer')).toBe(false);
    note.value = 'Facture'; // valeur posée par l'application, sans événement
    expect(echo.isEcho('Facture')).toBe(false);
    fire(document.body, 'click');
    expect(echo.isEcho('Facture')).toBe(true);
  });

  it('garde seulement la dernière saisie en cours d’un champ', () => {
    const { note } = form();
    echo = createEchoGuard(document);
    for (const value of ['F', 'Fa', 'Fac', 'Facture']) {
      note.value = value;
      fire(note, 'input');
    }
    expect(echo.isEcho('Facture')).toBe(true);
    expect(echo.isEcho('Fac')).toBe(false);
    note.value = 'Loyer';
    fire(note, 'input');
    expect(echo.isEcho('Facture')).toBe(false);
    expect(echo.isEcho('Loyer')).toBe(true);
  });

  it('ne lit jamais un mot de passe, une case à cocher ni une valeur trop courte', () => {
    const { note, pin } = form();
    echo = createEchoGuard(document);
    pin.value = 'Secret';
    fire(pin, 'input');
    fire(pin, 'change');
    note.value = 'A';
    fire(note, 'change');
    fire(document.body, 'click');
    expect(echo.isEcho('Secret')).toBe(false);
    expect(echo.isEcho('Facture')).toBe(false); // valeur d'une case à cocher
    expect(echo.isEcho('A')).toBe(false);
  });

  it('garde une liste bornée d’empreintes, sans texte, et s’arrête proprement', () => {
    const { note } = form();
    echo = createEchoGuard(document);
    for (let i = 0; i <= MAX_ECHOES; i++) {
      note.value = `Valeur ${i}`;
      fire(note, 'change');
    }
    expect(echo.isEcho('Valeur 0')).toBe(false); // la plus ancienne est oubliée
    expect(echo.isEcho(`Valeur ${MAX_ECHOES}`)).toBe(true);

    echo.stop();
    note.value = 'Facture';
    fire(note, 'change');
    expect(echo.isEcho('Facture')).toBe(false);
    expect(echo.isEcho(`Valeur ${MAX_ECHOES}`)).toBe(false);
  });

  it('page de test : les saisies de l’étape 3 réaffichées à l’étape 4 ne sont ni soumises ni modifiées', async () => {
    loadFixture(document, 3);
    const spy = spyEngine();
    const fake = createFakeStorage({ [SETTINGS_KEY]: {} });
    const log = recorder();
    const frames = manualFrames();
    controllers.push(
      await startContent(createSettingsStore(fake.storage), log.logger, {
        doc: document,
        engine: spy.engine,
        schedule: frames.schedule,
        highlights: null,
        now: frozenClock,
      }),
    );
    // L'utilisateur saisit une note, puis clique « Continuer » : l'application affiche l'étape 4.
    const note = document.getElementById('note') as HTMLTextAreaElement;
    note.value = 'Facture';
    fire(note, 'input');
    const values = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].map((field) => field.value);
    fire(document.querySelector('[data-go="4"]')!, 'click');
    expect([...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].map((field) => field.value)).toEqual(values);

    showStep(document, 4);
    // Récapitulatif hypothétique qui réaffiche le motif et la note (absent de D8, voir Q20).
    const recap = document.createElement('section');
    recap.innerHTML = '<p>Paiement de services</p><p>Note : Facture</p><p>Facture</p>';
    document.getElementById('app')!.append(recap);
    await frames.frames();

    expect(spy.requested()).not.toContain('Paiement de services');
    expect(spy.requested().filter((text) => /Facture/u.test(text))).toEqual([]);
    // 6 `dd` (le téléphone, sans lettre, est compté à part) et 3 échos.
    expect(controllers[0]!.snapshot().counts).toMatchObject({ values: 6 + 3, numeric: 1 });

    // 3.6 : ni le journal ni le stockage ne contiennent une saisie ou son empreinte.
    const traces = JSON.stringify({ events: log.events, storage: [...fake.data] });
    for (const secret of ['Facture', 'Paiement', 'Loyer', hashText('Facture'), hashText('Paiement de services')]) {
      expect(traces).not.toContain(secret);
    }
  });
});
