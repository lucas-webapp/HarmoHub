// Aides communes aux specs du module « mobile » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// Ce module couvre la mise en page « téléphone » (< 900 px) : barre du haut, onglets, bande du bas, « + Accord », « + Section », gestes au doigt.
// Les parcours fins (ajout rapide, sélection, annuler, tempo, séquenceur, fichiers…) sont déjà éprouvés au téléphone par les modules grille, accord,
// lecture, sequenceur et fichiers : ici seulement ce qui est propre au téléphone et qu'ils ne couvrent pas.
import { expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import { caseN, reglagesMorceau } from '../grille/aide-grille';
import type { Accord } from '../support/appli';

export { C_AM_F_G, caseN, cases, noms, estMobile, reglagesMorceau, titresParties } from '../grille/aide-grille';
export { fenetre, ouvrirFenetre } from '../accord/aide-accord';

// Un morceau à deux parties, comme beaucoup de morceaux réels : « Couplet » (C Am F G) puis « Refrain » (F C).
export const DEUX_PARTIES = reglagesMorceau([
  { titre: 'Couplet', accords: [{ root: 'C', quality: '' }, { root: 'A', quality: 'min' }, { root: 'F', quality: '' }, { root: 'G', quality: '' }] as Accord[] },
  { titre: 'Refrain', accords: [{ root: 'F', quality: '' }, { root: 'C', quality: '' }] as Accord[] },
]);

// ---------- les éléments (identifiants stables de l'appli ; noms accessibles en français) ----------
export const logo = (page: Page): Locator => page.getByRole('link', { name: 'HarmoHub' });
export const titre = (page: Page): Locator => page.locator('#tb-titre');
export const boutonEnregistrer = (page: Page): Locator => page.locator('#tb-save');
export const voyant = (page: Page): Locator => page.locator('#tb-etat');
export const onglets = (page: Page): Locator => page.getByRole('group', { name: 'Vues du morceau' });
export const ongletGrille = (page: Page): Locator => page.locator('#tab-grille');
export const ongletStructure = (page: Page): Locator => page.locator('#structure-btn');
export const ongletParoles = (page: Page): Locator => page.locator('#lyrics-btn');
export const annuler = (page: Page): Locator => page.locator('#global-undo-btn');
export const retablir = (page: Page): Locator => page.locator('#global-redo-btn');
export const parametres = (page: Page): Locator => page.locator('#open-settings');
export const compte = (page: Page): Locator => page.locator('#google-signin-btn');

export const resume = (page: Page): Locator => page.locator('#song-summary');           // « C · 120 BPM · 4/4 » ; ouvre « Réglages du morceau »
export const reglagesMorceauPanneau = (page: Page): Locator => page.getByRole('group', { name: 'Réglages du morceau' });
export const boutonAffichage = (page: Page): Locator => page.locator('#tel-affichage');
export const boutonSequenceurHaut = (page: Page): Locator => page.locator('#tel-sequenceur');

export const bandeClavier = (page: Page): Locator => page.locator('#toggle-viz-piano');
export const bandeGuitare = (page: Page): Locator => page.locator('#toggle-viz-guitar');
export const bandeFichier = (page: Page): Locator => page.locator('#file-menu-btn');
export const barreLecture = (page: Page): Locator => page.getByRole('toolbar', { name: 'Lecture' });
export const boutonPlus = (page: Page): Locator => page.locator('#bl-plus');             // « … » de la barre de lecture
export const panneauLecture = (page: Page): Locator => page.getByRole('dialog', { name: 'Lecture', exact: true });
export const voirClavier = (page: Page): Locator => page.locator('#pl-clavier');
export const voirGuitare = (page: Page): Locator => page.locator('#pl-guitare');
export const voirSequenceur = (page: Page): Locator => page.locator('#pl-notes');

export const boutonAccord = (page: Page, partie: number): Locator => page.locator('#progression-sections .prog-section-ajout').nth(partie);   // « + Accord »
export const boutonSection = (page: Page): Locator => page.locator('#add-section');                                                           // « + Section »
export const panneauAjout = (page: Page): Locator => page.getByRole('dialog', { name: 'Ajouter des accords' });
export const saisieAjout = (page: Page): Locator => page.locator('#quick-add-input');
export const menuContextuel = (page: Page): Locator => page.locator('#context-menu');
export const actionMenu = (page: Page, nom: string | RegExp): Locator => menuContextuel(page).getByRole('button', { name: nom });
export const fenetreAccord = (page: Page): Locator => page.getByRole('dialog', { name: /^Accord / });

// ---------- mesures ----------
export type Boite = { x: number; y: number; width: number; height: number };
export const boite = async (l: Locator): Promise<Boite> => (await l.boundingBox())!;
export const defilementHorizontal = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
export const defilementVertical = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
export const hauteurCase = async (page: Page, partie = 0, n = 0) => Math.round((await boite(caseN(page, partie, n))).height);

// Un élément tient entièrement dans l'écran (à 1 px près).
export async function tientDansL_ecran(page: Page, l: Locator) {
  const b = await boite(l), v = page.viewportSize()!;
  expect(b.x, 'bord gauche').toBeGreaterThanOrEqual(-1);
  expect(b.y, 'bord haut').toBeGreaterThanOrEqual(-1);
  expect(b.x + b.width, 'bord droit').toBeLessThanOrEqual(v.width + 1);
  expect(b.y + b.height, 'bord bas').toBeLessThanOrEqual(v.height + 1);
}

// ---------- gestes au doigt ----------
// Chromium (Android) : vrais évènements tactiles par le protocole DevTools (touchStart / touchMove / touchEnd, défilement tactile).
// WebKit (iPhone) : Playwright n'offre ni geste composé ni molette en WebKit mobile ; on le dit dans chaque aide, et les tests qui n'ont aucun
// équivalent honnête y sont ignorés avec la raison (voir `gesteComposeDisponible`).
export const estChromium = (page: Page) => page.context().browser()?.browserType().name() === 'chromium';
export const gesteComposeDisponible = estChromium;

async function cdp(page: Page) {
  return page.context().newCDPSession(page);
}
const pause = (ms: number) => new Promise<void>(fin => setTimeout(fin, ms));   // durée d'un appui : inhérente au geste, pas une attente d'état

// APPUI LONG sur un élément (l'appli ouvre le menu de la case après 550 ms de doigt immobile). Chromium : vrai toucher tenu 800 ms ;
// WebKit : suite touchstart → attente → touchend envoyée dans la page, au même point (WebKit mobile n'a pas de constructeur `Touch`).
export async function appuiLong(page: Page, cible: Locator, dureeMs = 800) {
  const b = await boite(cible);
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  if (estChromium(page)) {
    const c = await cdp(page);
    await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await pause(dureeMs);
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await c.detach();
    return;
  }
  await cible.evaluate(async (el, ms) => {
    const r = el.getBoundingClientRect();
    const pt = { identifier: 1, target: el, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, pageX: r.x + r.width / 2, pageY: r.y + r.height / 2 };
    const envoi = (type: string) => {
      const e = new Event(type, { bubbles: true, cancelable: true });
      const touches = type === 'touchend' ? [] : [pt];
      Object.defineProperty(e, 'touches', { value: touches });
      Object.defineProperty(e, 'targetTouches', { value: touches });
      Object.defineProperty(e, 'changedTouches', { value: [pt] });
      el.dispatchEvent(e);
    };
    envoi('touchstart');
    await new Promise(fin => setTimeout(fin, ms));
    envoi('touchend');
  }, dureeMs);
}

// GLISSÉ DU DOIGT d'un point à un autre (Chromium seulement), en `pas` étapes.
export async function glisserDoigt(page: Page, de: { x: number; y: number }, vers: { x: number; y: number }, pas = 10) {
  const c = await cdp(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [de] });
  for (let i = 1; i <= pas; i++)
    await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: de.x + (vers.x - de.x) * i / pas, y: de.y + (vers.y - de.y) * i / pas }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}

// PINCEMENT à deux doigts, horizontal, autour de (cx, cy), d'un demi-écart `de` à `vers` (Chromium seulement).
export async function pincer(page: Page, cx: number, cy: number, de: number, vers: number, pas = 12) {
  const c = await cdp(page);
  const doigts = (d: number) => [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }];
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: doigts(de) });
  for (let i = 1; i <= pas; i++) { await pause(16); await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: doigts(de + (vers - de) * i / pas) }); }
  await pause(50);
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}

// DÉFILER la page d'un doigt de `dy` pixels (positif = on descend dans la page). Chromium : vrai glissé tactile, du bas vers le haut ;
// WebKit mobile : ni geste composé ni molette → défilement de la fenêtre (même résultat pour la mise en page, pas le même geste).
export async function defiler(page: Page, dy: number, depuis?: { x: number; y: number }) {
  const v = page.viewportSize()!;
  const de = depuis ?? { x: v.width / 2, y: Math.min(v.height - 150, 300 + dy) };
  if (estChromium(page)) await glisserDoigt(page, de, { x: de.x, y: de.y - dy }, Math.max(8, Math.round(dy / 25)));
  else await page.evaluate(d => window.scrollBy(0, d), dy);
}

