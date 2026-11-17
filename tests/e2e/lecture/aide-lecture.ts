// Aides communes aux specs du module « lecture » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// Le son est factice dans la VM : on vérifie l'ÉTAT de l'appli (case en lecture, mesure affichée, boutons), jamais l'audio.
import { expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import { caseN, estMobile } from '../grille/aide-grille';

export { C_AM_F_G, caseN, cases, estMobile, reglagesMorceau, selectionner } from '../grille/aide-grille';

// La barre de lecture (en bas) et ses boutons : `id` stables, `aria-label` en français.
export const barre = (page: Page): Locator => page.getByRole('toolbar', { name: 'Lecture' });
export const boutonLecture = (page: Page): Locator => barre(page).getByRole('button', { name: 'Lecture', exact: true });
export const boutonStop = (page: Page): Locator => barre(page).getByRole('button', { name: 'Stop', exact: true });
export const boutonBoucle = (page: Page): Locator => barre(page).getByRole('button', { name: /^Bouc/ });   // « Boucler — … », « Boucle activée — … »

// La fenêtre « Tempo et vitesse de lecture » (ordinateur : sous le bouton « 120 BPM » ; téléphone : panneau « Lecture », ouvert par « … »).
export const fenetreTempo = (page: Page): Locator =>
  estMobile(page) ? page.getByRole('dialog', { name: 'Lecture', exact: true }) : page.getByRole('dialog', { name: 'Tempo et vitesse de lecture' });

export async function ouvrirTempo(page: Page): Promise<Locator> {
  const f = fenetreTempo(page);
  if (await f.isVisible()) return f;
  await (estMobile(page) ? page.locator('#bl-plus') : page.locator('#bl-tempo')).click();
  await expect(f).toBeVisible();
  return f;
}
export async function fermerTempo(page: Page) {
  const f = fenetreTempo(page);
  if (!(await f.isVisible())) return;
  if (estMobile(page)) await f.getByRole('button', { name: 'Fermer le panneau Lecture' }).click();
  else await page.keyboard.press('Escape');
  await expect(f).toBeHidden();
}

// Les composants de la fenêtre (mêmes `id` à l'ordinateur et au téléphone).
export const valeurTempo = (page: Page): Locator => page.locator('#bl-tempo-pop-val');
export const plusLent = (page: Page): Locator => page.getByRole('button', { name: 'Plus lent', exact: true });
export const plusRapide = (page: Page): Locator => page.getByRole('button', { name: 'Plus rapide', exact: true });
export const boutonTap = (page: Page): Locator => page.getByRole('button', { name: 'TAP', exact: true });
export const curseurVitesse = (page: Page): Locator => page.getByRole('slider', { name: 'Vitesse de lecture, de 50 à 200 %' });
export const boutonMetronome = (page: Page): Locator => page.getByRole('button', { name: 'Garder le métronome pendant la lecture de la grille' });
export const boutonCroche = (page: Page): Locator => page.getByRole('button', { name: 'Clic du métronome à la croche (contretemps)' });

// État lu dans l'appli (l'appli est la source de vérité ; jamais utilisé pour DÉCLENCHER quelque chose).
export const tempo = (page: Page): Promise<number> => page.evaluate(() => (window as any).app.tempoCourant());
export const enLecture = (page: Page): Promise<boolean> => page.evaluate(() => (window as any).app.isPlaying);
export const caseEnLecture = (page: Page) => page.locator('#progression-sections .grid-cell.playing');
export const plage = (page: Page) => page.evaluate(() => (window as any).app.loopRange as null | { startSection: number; startIndex: number; endSection: number; endIndex: number });

// La mesure affichée : « Mesure en cours : 2 sur 4 » (ordinateur, infobulle) ou « Mes. 2 » (téléphone).
export async function mesureAffichee(page: Page): Promise<number> {
  const el = page.locator('#bl-mesure');
  // ordinateur : le nom accessible est l'infobulle « Mesure en cours : 2 sur 4 » ; téléphone : le texte « Mes. 2 »
  const texte = estMobile(page) ? await el.innerText() : (await el.getAttribute('title')) ?? '';
  const m = texte.match(/(\d+)/);
  return m ? Number(m[1]) : NaN;
}

// Suite des mesures affichées, relevée par un observateur de la page (comme `observerPassages`, pour ne rien manquer quand la machine est chargée).
export async function observerMesures(page: Page) {
  await page.evaluate(() => {
    const w = window as any, el = document.querySelector('#bl-mesure')!;
    const lire = () => { const m = ((el.getAttribute('title') || '') + ' ' + (el as HTMLElement).innerText).match(/(\d+)/); return m ? Number(m[1]) : NaN; };
    w.__mesures = [lire()];
    new MutationObserver(() => { const n = lire(); if (n !== w.__mesures[w.__mesures.length - 1]) w.__mesures.push(n); }).observe(el, { subtree: true, childList: true, characterData: true, attributes: true });
  });
}
export const mesuresVues = (page: Page) => page.evaluate(() => (window as any).__mesures as number[]);

// Règle des mesures d'une partie : les numéros « 1 2 3 4 5 » sous la grille (le dernier est la fin de la partie).
export const reglette = (page: Page, partie = 0): Locator => page.locator(`#progression-sections .chord-grid`).nth(partie).locator('.row-measure');

// Trace une plage à boucler sur la règle comme l'utilisateur : appuyer sur le numéro d'une mesure, glisser jusqu'à une autre, relâcher.
// `de` et `a` : numéros de mesure (1 = première, un accord par mesure dans les morceaux de test) ; la plage couvre les mesures de `de` à `a` incluses.
// BUG L-01 (bugs.md) : la zone sensible de la règle est décalée vers la droite (10 px sous le « 2 », 24 px sous le « 4 ») ; appuyer au CENTRE du
// numéro « 4 » commence la plage à la mesure 3. On appuie donc tout au bord droit du numéro (là où le bon résultat est garanti) et on lâche à
// l'aplomb du milieu de la case visée. Le test de ce défaut, lui, appuie au centre (`regle.spec.ts`).
export async function tracerPlage(page: Page, de: number, a: number, partie = 0) {
  const numero = (await reglette(page, partie).nth(de - 1).boundingBox())!;
  const fin = (await caseN(page, partie, a - 1).boundingBox())!;
  const y = numero.y + numero.height / 2;
  await page.mouse.move(numero.x + numero.width - 2, y);
  await page.mouse.down();
  await page.mouse.move((numero.x + fin.x) / 2 + numero.width * 0.5, y, { steps: 4 });
  await page.mouse.move(fin.x + fin.width * 0.5, y, { steps: 6 });
  await page.mouse.up();
}

// Accélère la lecture pour que les tests soient courts : vitesse 200 % (une mesure à 120 BPM dure alors 1 s au lieu de 2 s).
export async function vitesseMax(page: Page) {
  await ouvrirTempo(page);
  await curseurVitesse(page).fill('200');
  await expect(page.locator('#bl-vitesse-val')).toHaveText('200 %');
  await fermerTempo(page);
}

// Note, sur l'horloge de la page, l'instant où chaque case s'allume. Un observateur de la page voit TOUS les changements, alors qu'un test qui
// interroge la page à intervalles réguliers peut en manquer un quand la machine est chargée (WebKit sur iPhone, mesuré : 1 fois sur 8).
export async function observerPassages(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    // remise à zéro ; l'observateur n'est posé qu'une fois. On jette aussi les changements qu'il n'a pas encore livrés (une machine chargée
    // les livre en retard : ceux d'une lecture précédente se mêleraient à la suivante — vu sous Firefox, 1 fois sur 10 en test parallèle).
    if (w.__observateurPassages) w.__observateurPassages.takeRecords();
    w.__passages = [];
    w.__simultanees = 0;
    if (w.__observateurPassages) return;
    const noter = (enregistrements: MutationRecord[]) => {
      const maintenant = performance.now();
      w.__simultanees = Math.max(w.__simultanees || 0, document.querySelectorAll('#progression-sections .grid-cell.playing').length);
      const ajout = (c: HTMLElement) => {
        const i = Number(c.dataset.index), s = Number(c.dataset.section);
        const d = w.__passages[w.__passages.length - 1];
        if (!d || d.i !== i || d.s !== s) w.__passages.push({ s, i, t: maintenant });
      };
      // Chaque enregistrement garde l'ancienne valeur de `class` : on retrouve ainsi toutes les cases passées en lecture, même si l'observateur
      // est appelé tard et que plusieurs changements se sont empilés.
      enregistrements.forEach((r, k) => {
        if (r.type === 'childList') { r.addedNodes.forEach(n => { if (n instanceof HTMLElement) n.querySelectorAll('.grid-cell.playing').forEach(c => ajout(c as HTMLElement)); }); return; }
        const cible = r.target as HTMLElement;
        if (!cible.classList.contains('grid-cell')) return;
        const suivant = enregistrements.slice(k + 1).find(x => x.target === cible && x.attributeName === 'class');
        const apres = suivant ? suivant.oldValue || '' : cible.className;
        if (/\bplaying\b/.test(apres) && !/\bplaying\b/.test(r.oldValue || '')) ajout(cible);
      });
    };
    w.__observateurPassages = new MutationObserver(noter);
    w.__observateurPassages.observe(document.querySelector('#progression-sections')!, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['class'] });
  });
}
// Plus grand nombre de cases allumées en même temps depuis la dernière remise à zéro (doit rester à 1 : une seule case est en lecture).
export const maxSimultanees = (page: Page) => page.evaluate(() => (window as any).__simultanees as number);
export const passagesVus = (page: Page) => page.evaluate(() => (window as any).__passages as { s: number; i: number; t: number }[]);

// Démarre la lecture et attend qu'elle ait VRAIMENT commencé (une mesure de décompte, puis la première case s'allume).
export async function lireEtAttendre(page: Page) {
  await observerPassages(page);
  await boutonLecture(page).click();
  await expect.poll(() => enLecture(page)).toBe(true);
  await expect(caseEnLecture(page).first()).toBeVisible({ timeout: 12_000 });
}

// Indice (dans sa partie) de la case allumée à l'instant.
export const indiceEnLecture = (page: Page): Promise<number | null> =>
  page.evaluate(() => { const c = document.querySelector('#progression-sections .grid-cell.playing'); return c ? Number((c as HTMLElement).dataset.index) : null; });

// Attend que la tête de lecture ait visité tous les indices demandés ; renvoie la suite des cases allumées jusque-là (« lireEtAttendre » doit avoir été appelé).
export async function suivreTete(page: Page, attendus: number[], delai = 25_000): Promise<number[]> {
  await expect.poll(async () => { const v = (await passagesVus(page)).map(p => p.i); return attendus.every(a => v.includes(a)); }, { timeout: delai }).toBe(true);
  return (await passagesVus(page)).map(p => p.i);
}
// Attend les n premières cases allumées successives et les renvoie (indices, ou « partie.indice » pour `suivreSequenceCases`).
export async function suivreSequence(page: Page, n: number, delai = 30_000): Promise<number[]> {
  await expect.poll(async () => (await passagesVus(page)).length >= n, { timeout: delai }).toBe(true);
  return (await passagesVus(page)).slice(0, n).map(p => p.i);
}
export async function suivreSequenceCases(page: Page, n: number, delai = 30_000): Promise<string[]> {
  await expect.poll(async () => (await passagesVus(page)).length >= n, { timeout: delai }).toBe(true);
  return (await passagesVus(page)).slice(0, n).map(p => `${p.s}.${p.i}`);
}

// Durée moyenne (ms) d'une case de 4 temps, mesurée sur les 3 premiers passages (donc 2 cases complètes).
export async function dureeMoyenneMesure(page: Page): Promise<number> {
  await expect.poll(async () => (await passagesVus(page)).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(3);
  const t = (await passagesVus(page)).map(p => p.t);
  return (t[2] - t[0]) / 2;
}


// Espionne les clics du métronome (le son lui-même est factice dans la VM : on compte les appels, on n'écoute rien).
export async function espionnerClics(page: Page) {
  await page.evaluate(() => {
    const a = (window as any).app;
    const dejaPose = Array.isArray(a.__clics);
    a.__clics = [];   // remet le compteur à zéro ; l'espion n'est posé qu'une fois
    if (dejaPose) return;
    const origine = a.playMetronomeClick.bind(a);
    a.playMetronomeClick = (...x: any[]) => { a.__clics.push(x.map(String).join(',')); return origine(...x); };
  });
}
export const nombreDeClics = (page: Page): Promise<number> => page.evaluate(() => (window as any).app.__clics.length);
export async function attendreFinDeLecture(page: Page, delai = 30_000) {
  await expect.poll(() => enLecture(page), { timeout: delai }).toBe(false);
}

export { caseN };
