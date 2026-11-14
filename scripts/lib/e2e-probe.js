/*
 * Sonde de page du banc de test de l'extension (scripts/e2e-extension.ts).
 *
 * Injectée par CDP avant les scripts de la page, dans le monde de la page : elle voit le DOM comme
 * l'application le voit, jamais l'état interne de l'extension. JavaScript brut, sans transpilation,
 * pour que le texte injecté soit exactement celui de ce fichier.
 */
(() => {
  const records = [];
  const textChanges = [];
  const longtasks = [];

  const observer = new MutationObserver((list) => {
    const at = performance.now();
    for (const r of list) {
      const inBody = document.body !== null && document.body.contains(r.target);
      records.push({
        type: r.type,
        at,
        inBody,
        target: r.target.nodeName,
        attribute: r.attributeName,
        added: Array.from(r.addedNodes, (n) => n.nodeName).join(','),
        removed: r.removedNodes.length,
      });
      if (r.type === 'characterData') textChanges.push({ node: r.target, at });
    }
  });
  observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true });

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longtasks.push({ start: e.startTime, duration: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    // API absente : pas de mesure des tâches longues.
  }

  const textNodes = (root) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) out.push(n);
    return out;
  };

  /** Squelette : le HTML du corps, chaque texte vidé. Égal ⇔ seule la valeur des textes diffère. */
  const skeleton = () => {
    const clone = document.body.cloneNode(true);
    for (const t of textNodes(clone)) t.data = '';
    return clone.innerHTML;
  };

  const MARKS = [
    ['finethnic-mark-unverified', 'unverified'],
    ['finethnic-mark-partial', 'partial'],
  ];

  /** Nœuds de texte marqués par l'extension (CSS Custom Highlight API), ou null si le registre est absent. */
  const markedNodes = () => {
    if (typeof CSS === 'undefined' || !CSS.highlights) return null;
    const out = new Map();
    for (const [name, kind] of MARKS) {
      const highlight = CSS.highlights.get(name);
      if (highlight) for (const range of highlight) out.set(range.startContainer, kind);
    }
    return out;
  };

  const STEPS = { 2: 1, '1,3': 2, '2,4': 3, '3,5': 4, 1: 5 };
  const currentStep = () => {
    const targets = new Set(Array.from(document.querySelectorAll('#app [data-go]'), (e) => e.getAttribute('data-go')));
    return STEPS[Array.from(targets).sort().join(',')] ?? 0;
  };

  const controlValues = () =>
    Array.from(document.querySelectorAll('input, select, textarea'), (e) =>
      e.type === 'checkbox' || e.type === 'radio' ? String(e.checked) : e.value,
    );

  const describeTexts = (nodes) => {
    const marks = markedNodes();
    return {
      texts: nodes.map((n) => n.data),
      valueLike: nodes.map((n) => /\d/u.test(n.data) || n.parentElement?.closest('dd, time, strong, input, select, textarea') != null),
      marks: marks === null ? null : nodes.map((n) => marks.get(n) ?? ''),
    };
  };

  const probe = {
    now: () => performance.now(),
    checkpoint: () => records.length,
    /** Mutations depuis un point de contrôle : nombre par type, et les mutations hors texte en clair. */
    since(checkpoint) {
      const list = records.slice(checkpoint);
      const byType = {};
      for (const r of list) byType[r.type] = (byType[r.type] ?? 0) + 1;
      return {
        total: list.length,
        byType,
        structural: list.filter((r) => r.type !== 'characterData').map((r) => `${r.type}:${r.target}:${r.attribute ?? ''}:+${r.added}:-${r.removed}:${r.inBody ? 'body' : 'hors-body'}`),
        lastAt: list.length ? list[list.length - 1].at : null,
        lastTextAt: list.filter((r) => r.type === 'characterData').reduce((max, r) => Math.max(max, r.at), -1),
      };
    },
    lastMutationAt: () => (records.length ? records[records.length - 1].at : 0),
    snapshot() {
      return {
        html: document.body.innerHTML,
        skeleton: skeleton(),
        values: controlValues(),
        step: currentStep(),
        outside: Array.from(document.documentElement.children, (e) => e.localName).filter((n) => n !== 'head' && n !== 'body'),
        ...describeTexts(textNodes(document.body)),
      };
    },
    /** Ajoute d'un seul coup des éléments construits par le DOM (pas de HTML), dans `#id`. */
    inject(id, items, into) {
      const host = document.createElement('section');
      host.id = id;
      for (const item of items) {
        const el = document.createElement(item.tag ?? 'p');
        for (const [name, value] of Object.entries(item.attrs ?? {})) el.setAttribute(name, value);
        if (item.text !== undefined) el.textContent = item.text;
        host.append(el);
      }
      const t0 = performance.now();
      (into ? document.querySelector(into) : document.body).append(host);
      return t0;
    },
    /** Texte, marque et heure de la dernière écriture de chaque élément de `selector` (premier nœud de texte). */
    items(selector) {
      const elements = Array.from(document.querySelectorAll(selector));
      const nodes = elements.map((e) => textNodes(e)[0] ?? null);
      const marks = markedNodes();
      return elements.map((e, i) => {
        const node = nodes[i];
        const writes = node ? textChanges.filter((c) => c.node === node) : [];
        return {
          text: node ? node.data : '',
          mark: marks === null || !node ? null : (marks.get(node) ?? ''),
          firstWriteAt: writes.length ? writes[0].at : null,
        };
      });
    },
    setText(selector, text) {
      const node = textNodes(document.querySelector(selector))[0];
      node.data = text;
      return performance.now();
    },
    longtasks: (from = 0) => longtasks.filter((t) => t.start + t.duration >= from),
    /** Premier élément interactif dont le texte porte une marque de l'extension, ou null. */
    markedControl() {
      const marks = markedNodes();
      if (marks === null) return null;
      for (const node of marks.keys()) {
        const control = node.parentElement?.closest('button, a[href]');
        if (control && document.body.contains(control)) return control.outerHTML;
      }
      return null;
    },
    focusMarkedControl() {
      const marks = markedNodes();
      for (const node of marks?.keys() ?? []) {
        const control = node.parentElement?.closest('button, a[href]');
        if (control && document.body.contains(control)) {
          control.focus();
          return document.activeElement === control;
        }
      }
      return false;
    },
    blur: () => document.activeElement?.blur(),
    timing() {
      const nav = performance.getEntriesByType('navigation')[0];
      const dcl = nav ? nav.domContentLoadedEventEnd : null;
      // L'analyseur HTML de Chrome produit aussi des `characterData` (texte reçu en plusieurs morceaux) avant
      // DOMContentLoaded ; le script de contenu (document_idle) n'écrit qu'après.
      const firstText = dcl === null ? undefined : records.find((r) => r.type === 'characterData' && r.at >= dcl);
      return {
        domContentLoaded: dcl,
        load: nav ? nav.loadEventEnd : null,
        firstTextAt: firstText ? firstText.at : null,
      };
    },
    storage: () => ({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie }),
  };

  Object.defineProperty(window, '__probe', { value: Object.freeze(probe) });
})();
