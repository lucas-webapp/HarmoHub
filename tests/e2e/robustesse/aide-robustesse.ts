// Aides communes aux specs du module « robustesse » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// Ce module éprouve l'appli quand les choses vont mal : rien à afficher, beaucoup à afficher, stockage refusé ou plein, page rechargée en pleine
// édition, deux onglets sur les mêmes données, réseau coupé. Ce qui est déjà dit ailleurs n'est pas redit ici : le SDK Firebase qui ne se charge pas
// (demarrage/hors-ligne), les réglages abîmés (parametres/persistance), la coupure du réseau AVEC un compte connecté (synchro/reseau).
import { expect } from '../support/fixtures';
import type { Page, Locator, BrowserContext } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import { estMobile } from '../grille/aide-grille';
import { reglagesMorceau } from '../grille/aide-grille';
import type { Accord } from '../support/appli';

export { C_AM_F_G, estMobile, cases, noms, caseN, titres, reglagesMorceau } from '../grille/aide-grille';
export { titre, etat, toast, boutonEnregistrer, champNomMorceau, bibliotheque, morceauxStockes, morceauCourantId, enregistrerSous, modifierLeMorceau, ouvrirMesMorceaux, fenetreMorceaux, ligne, telecharger, jsonDe, lireMidi, choisirDansMenuFichiers, choisirDansMenuMorceau, ouvrirMenuMorceau, menuMorceau, creerMorceau } from '../fichiers/aide-fichiers';

// ---------- erreurs de la page ----------
// Les exceptions JavaScript NON interceptées de la page (ce que l'utilisateur ne voit pas, mais qui dit qu'un geste a planté en route).
export function collecterErreurs(page: Page): string[] {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  return erreurs;
}

// ---------- gestes d'utilisateur qui marchent à l'ordinateur comme au téléphone ----------
// Ajoute des accords à la fin de la première partie : le champ « + » de la grille à l'ordinateur, le panneau « Ajout rapide » au téléphone.
export async function ajouterAccords(page: Page, accords: string[]) {
  if (estMobile(page)) {
    await page.locator('.prog-section-ajout').first().click();
    const saisie = page.locator('#quick-add-input');
    await expect(saisie).toBeVisible();
    await saisie.fill(accords.join('//'));
    await page.locator('#quick-add-btn').click();
    await page.keyboard.press('Escape');
  } else {
    const plus = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
    for (const a of accords) { await plus.click(); await plus.fill(a); await plus.press('Enter'); }
  }
}

// ---------- un morceau de départ de toute taille ----------
const RACINES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], QUALITES = ['', 'min', 'dom7', 'maj7'];
export function accordsVaries(n: number, decalage = 0): Accord[] {
  return Array.from({ length: n }, (_, j) => ({ root: RACINES[(decalage + j) % 7], quality: QUALITES[((decalage + 1) * (j + 1)) % 4] }));
}
// Un morceau de `nParties` parties de `nAccords` accords chacune (« Partie 1 » … « Partie N »), posé dans le stockage local avant le chargement.
export function morceauLong(nParties: number, nAccords: number, nom = 'Long'): Record<string, string> {
  return reglagesMorceau(Array.from({ length: nParties }, (_, i) => ({ titre: 'Partie ' + (i + 1), accords: accordsVaries(nAccords, i) })), nom);
}

// ---------- un deuxième onglet du MÊME navigateur (même stockage local) ----------
// La fenêtre d'accueil du compte se garde par onglet (sessionStorage) : on la passe comme l'utilisateur.
export async function ouvrirOnglet(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript(() => sessionStorage.setItem('cc_accueil_vu', '1'));
  await page.goto('/index.html');
  await page.waitForFunction(() => !!(window as any).app);
  const accueil = page.locator('#cloud-guard-modal'), pilule = page.locator('#google-signin-btn');
  await expect(accueil.or(pilule).first()).toBeVisible({ timeout: 15_000 });
  if (await accueil.isVisible()) { await page.locator('#cloud-guard-continue').click(); await expect(accueil).toBeHidden(); }
  return page;
}

// ---------- un stockage qui refuse ----------
// À poser AVANT le chargement de la page (`addInitScript`). Rien ne refuse tant que `window.__refus` n'est pas armé : la graine de la fixture
// et l'appli démarrent normalement. `armerRefus` dit ensuite quelles CLÉS refusent leur écriture (expression régulière) ;
// `lecture` fait aussi lever `getItem`. La lèvée est celle d'un navigateur : `QuotaExceededError` (plein) ou `SecurityError` (bloqué).
export async function preparerRefusStockage(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__refus = { cles: null as string | null, lecture: false, erreur: 'QuotaExceededError', ecritures: 0, lectures: 0 };
    const setItem = Storage.prototype.setItem, getItem = Storage.prototype.getItem;
    const leve = () => new DOMException(w.__refus.erreur === 'SecurityError' ? 'The operation is insecure.' : 'The quota has been exceeded.', w.__refus.erreur);
    Storage.prototype.setItem = function (k: string, v: string) {
      if (this !== window.sessionStorage && w.__refus.cles && new RegExp(w.__refus.cles).test(k)) { w.__refus.ecritures++; throw leve(); }
      return setItem.call(this, k, v);
    };
    Storage.prototype.getItem = function (k: string) {
      if (this !== window.sessionStorage && w.__refus.lecture) { w.__refus.lectures++; throw leve(); }
      return getItem.call(this, k);
    };
  });
}
export const armerRefus = (page: Page, refus: { cles?: string | null; lecture?: boolean; erreur?: 'QuotaExceededError' | 'SecurityError' }) =>
  page.evaluate((r) => { Object.assign((window as any).__refus, r); }, refus);
export const refusVus = (page: Page): Promise<{ ecritures: number; lectures: number }> =>
  page.evaluate(() => ({ ecritures: (window as any).__refus.ecritures, lectures: (window as any).__refus.lectures }));

// IndexedDB qui refuse (navigation privée de certains navigateurs, stockage bloqué) : `indexedDB.open` lève, comme une page sans droit.
export function indexedDBRefuse(page: Page) {
  return page.addInitScript(() => {
    const refus = () => { throw new DOMException('The operation is insecure.', 'SecurityError'); };
    IDBFactory.prototype.open = refus as any;
    IDBFactory.prototype.deleteDatabase = refus as any;
  });
}

// ---------- ce que la barre du haut dit ----------
// Les messages que l'utilisateur peut voir : le toast, une boîte d'alerte, une fenêtre de dialogue. Sert à vérifier qu'un échec est DIT.
export const messagesVisibles = (page: Page): Locator => page.locator('#toast, [role="alert"], [role="alertdialog"], [role="dialog"]').filter({ visible: true });
