/*
 * Démonstration P7 — contenu injecté après le chargement (ROADMAP P7.1, tests T-INE).
 *
 * À coller dans la console DevTools d'un onglet ouvert sur la page de test SAFINUM, extension installée et
 * traduction activée. Ce script est HORS extension : il imite l'application (ou le jury) qui ajoute des
 * messages après le chargement. Il n'écrit que dans son propre panneau, ajouté en haut de la page, et ne lit
 * rien d'autre que ce panneau.
 *
 * Dans la console :
 *   finethnicDemo.tout()           tous les échantillons, l'un après l'autre
 *   finethnicDemo.confirmation()   message de succès
 *   finethnicDemo.avertissement()  message d'avertissement (role="alert")
 *   finethnicDemo.erreur()         deux messages d'erreur (role="alert")
 *   finethnicDemo.lot()            10 messages ajoutés d'un coup
 *   finethnicDemo.inconnu()        phrase absente de la bibliothèque
 *   finethnicDemo.proche()         « Votre paiement a été envoyé avec succès. » (proche d'une entrée)
 *   finethnicDemo.dynamique()      montant et référence tirés au hasard
 *   finethnicDemo.zoneLive()       message écrit dans une zone aria-live existante
 *   finethnicDemo.dialogue()       boîte de dialogue modale
 *   finethnicDemo.reecriture()     l'application remet le français dans un texte traduit
 *   finethnicDemo.charge(500)      500 nœuds d'un coup, temps de traitement mesuré
 *   finethnicDemo.effacer()        retire le panneau
 *
 * Ce qu'on doit voir (contrat §5.4, C5) :
 *   - chaque message est détecté (compteurs du popup) ;
 *   - un texte traduit est soit validé (sans marque), soit marqué « non vérifié » (tirets) ou « partiel »
 *     (vagues) ; le français reste visible au survol et au focus ;
 *   - un texte inconnu, proche d'une entrée ou à valeurs dynamiques non couvertes reste en français ;
 *   - les montants, noms et références ne sont jamais modifiés ;
 *   - aucune boucle : après une réécriture par l'application, une seule nouvelle écriture.
 */
(() => {
  const PANEL_ID = 'finethnic-demo';

  /** Panneau de démonstration, créé au premier usage, en haut de la page. */
  const panel = () => {
    let host = document.getElementById(PANEL_ID);
    if (!host) {
      host = document.createElement('section');
      host.id = PANEL_ID;
      host.setAttribute('aria-label', 'Démonstration FinEthnic');
      Object.assign(host.style, { border: '2px dashed #888', margin: '8px', padding: '8px', font: '14px sans-serif' });
      document.body.prepend(host);
    }
    return host;
  };

  /** Ajoute d'un seul coup un groupe d'éléments construits par le DOM (pas de HTML) ; renvoie le groupe. */
  const add = (title, items) => {
    const group = document.createElement('div');
    group.dataset.demo = title;
    const heading = document.createElement('h3');
    heading.textContent = title;
    group.append(heading);
    for (const { tag = 'p', text, attrs = {} } of items) {
      const el = document.createElement(tag);
      for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
      el.textContent = text;
      group.append(el);
    }
    panel().append(group);
    return group;
  };

  const random = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const reference = () =>
    `SAF-2026-${Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[random(0, 31)]).join('')}`;

  /** Textes de la bibliothèque (D8), pour le lot de 10 et la charge. */
  const KNOWN = [
    'Montant',
    'Solde disponible',
    'Payer la facture',
    'Confirmer le transfert',
    'Frais de transfert',
    'Bénéficiaire',
    'Effectuer un transfert',
    'Votre compte',
    'Continuer',
    'Transfert effectué avec succès.',
  ];

  /** Attend que l'extension ait fini d'écrire dans `root` (300 ms sans écriture) ; renvoie le temps écoulé. */
  const settle = (root, started) =>
    new Promise((resolve) => {
      let last = performance.now();
      let writes = 0;
      const observer = new MutationObserver((records) => {
        last = performance.now();
        writes += records.filter((r) => r.type === 'characterData').length;
      });
      observer.observe(root, { subtree: true, characterData: true });
      const check = () => {
        if (performance.now() - last >= 300) {
          observer.disconnect();
          resolve({ ms: Math.round((writes ? last : started) - started), writes });
        } else setTimeout(check, 50);
      };
      setTimeout(check, 50);
    });

  const demo = {
    confirmation: () => add('Confirmation', [{ text: 'Transfert effectué avec succès.', attrs: { role: 'status' } }]),
    avertissement: () =>
      add('Avertissement', [{ text: 'Veuillez cocher la case de confirmation pour continuer.', attrs: { role: 'alert' } }]),
    erreur: () =>
      add('Erreur', [
        { text: 'Solde insuffisant pour effectuer cette opération.', attrs: { role: 'alert' } },
        { text: "Transaction échouée. Aucun montant n'a été débité.", attrs: { role: 'alert' } },
      ]),
    lot: () => add('Lot de 10 messages', KNOWN.map((text) => ({ text }))),
    inconnu: () => add('Texte inconnu', [{ text: 'Le guichet du marché ferme à midi le samedi.' }]),
    proche: () => add('Texte proche d’une entrée', [{ text: 'Votre paiement a été envoyé avec succès.' }]),
    dynamique: () =>
      add('Valeurs dynamiques', [
        { text: `Votre transfert de ${random(1, 250)} 000 FCFA vers Jean-Paul Mbarga a été effectué.` },
        { text: `Référence : ${reference()}` },
      ]),
    /** Zone aria-live créée vide, puis remplie : le message arrive dans une zone déjà présente. */
    zoneLive() {
      const group = add('Zone aria-live', [{ tag: 'div', text: '', attrs: { 'aria-live': 'polite', 'data-live': '' } }]);
      setTimeout(() => (group.querySelector('[data-live]').textContent = 'Montant'), 500);
      return group;
    },
    dialogue() {
      const dialog = document.createElement('dialog');
      dialog.dataset.demo = 'Boîte de dialogue';
      const text = document.createElement('p');
      text.textContent = 'Payer la facture';
      const close = document.createElement('button');
      close.textContent = 'Continuer';
      close.addEventListener('click', () => dialog.close());
      dialog.append(text, close);
      panel().append(dialog);
      dialog.showModal();
      return dialog;
    },
    /** L'application remet « Montant » dans un texte que l'extension vient de traduire. */
    reecriture() {
      const group = add('Réécriture par l’application', [{ text: 'Montant' }]);
      setTimeout(() => {
        const node = group.querySelector('p').firstChild;
        console.info(`[démo] avant réécriture : « ${node.data} »`);
        node.data = 'Montant';
        console.info('[démo] l’application a remis « Montant »');
      }, 1000);
      return group;
    },
    /** `n` nœuds ajoutés d'un coup (textes connus répétés) ; affiche le temps jusqu'à la dernière écriture. */
    async charge(n = 500) {
      const group = document.createElement('div');
      group.dataset.demo = `Charge (${n} nœuds)`;
      group.append(...Array.from({ length: n }, (_, i) => Object.assign(document.createElement('p'), { textContent: KNOWN[i % KNOWN.length] })));
      const started = performance.now();
      panel().append(group);
      const result = await settle(group, started);
      console.info(`[démo] ${n} nœuds : ${result.writes} texte(s) écrit(s), dernière écriture ${result.ms} ms après l’ajout (objectif < 200 ms)`);
      return result;
    },
    async tout() {
      const steps = ['confirmation', 'avertissement', 'erreur', 'lot', 'inconnu', 'proche', 'dynamique', 'zoneLive', 'reecriture'];
      for (const step of steps) {
        console.info(`[démo] ${step}`);
        demo[step]();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      console.info('[démo] terminé ; finethnicDemo.dialogue() et finethnicDemo.charge(500) se lancent à part.');
    },
    effacer: () => document.getElementById(PANEL_ID)?.remove(),
  };

  window.finethnicDemo = demo;
  console.info('[démo] prêt : finethnicDemo.tout(), finethnicDemo.charge(500)… (liste en tête du script)');
})();
