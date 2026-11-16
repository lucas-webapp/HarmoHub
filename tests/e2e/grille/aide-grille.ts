// Aides communes aux specs du module « grille » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
import { expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import type { Accord } from '../support/appli';

// Qualités telles que l'appli les enregistre : '' = majeur, 'min' = mineur, 'maj7', 'dim'…
export const C_AM_F_G: Accord[] = [
  { root: 'C', quality: '' }, { root: 'A', quality: 'min' }, { root: 'F', quality: '' }, { root: 'G', quality: '' },
];

const accordComplet = (a: Accord) => ({ root: a.root, quality: a.quality, beats: a.beats ?? 4, inversion: 0, drop: 'none', octave: 3, bass: null, playStyle: 'held' });

// Un morceau à PLUSIEURS parties, posé dans le stockage local avant le chargement (via l'option `reglages` de la fixture `ouvrirAppli`).
export function reglagesMorceau(parties: { titre: string; accords: Accord[] }[], nom = 'Démo'): Record<string, string> {
  const sections = parties.map(p => ({ title: p.titre, chords: p.accords.map(accordComplet) }));
  return {
    harmohubSongs: JSON.stringify([{ id: 'e2e-1', name: nom, savedAt: Date.now(), sections }]),
    harmohubCurrentSongId: 'e2e-1',
    myProgression: JSON.stringify({ sections }),
  };
}

export const estMobile = (page: Page) => page.viewportSize()!.width < 900;   // la mise en page « téléphone » de l'appli

// Les cases d'accord (toutes parties confondues) et leur nom affiché.
export const cases = (page: Page): Locator => page.locator('#progression-sections .grid-cell[data-index]');
export const caseN = (page: Page, partie: number, n: number): Locator =>
  page.locator(`#progression-sections .grid-cell[data-section="${partie}"][data-index="${n}"]`);
export async function noms(page: Page, partie?: number): Promise<string[]> {
  const loc = partie === undefined ? cases(page) : page.locator(`#progression-sections .grid-cell[data-section="${partie}"][data-index]`);
  return (await loc.locator('.cell-sym').allTextContents()).map(t => t.trim());
}
export const titresParties = (page: Page) => page.locator('#progression-sections .prog-title');
export async function titres(page: Page): Promise<string[]> {
  return titresParties(page).evaluateAll(els => els.map(e => (e as HTMLInputElement).value));
}
// Cases « sélectionnées » (classe `selected`) et « sélectionnées en groupe » (classe `multi-selected`), comme les voit l'utilisateur.
export const selectionnees = (page: Page) => page.locator('#progression-sections .grid-cell.selected');
export const groupe = (page: Page) => page.locator('#progression-sections .grid-cell.multi-selected');

// Ouvre le panneau d'ajout (champ « Ajout rapide ») avec le « + » devant la case n de la partie p, comme l'utilisateur.
// Le « + » est recouvert par la poignée de durée pour Playwright : on clique à la souris à son centre (réel, comme un doigt ou une souris).
export async function cliquerPlusAvant(page: Page, partie: number, n: number) {
  const c = caseN(page, partie, n);
  await c.hover();
  const plus = c.locator('.cell-ins');
  await expect(plus).toBeVisible();
  const b = (await plus.boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

// Saisie dans le panneau d'ajout rapide, validée par Ctrl+Entrée.
export async function saisirAjoutRapide(page: Page, texte: string) {
  const saisie = page.locator('#quick-add-input');
  await expect(saisie).toBeVisible();
  await saisie.fill(texte);
  await saisie.press('Control+Enter');
}

// Menu du clic droit (ordinateur) : ouvre sur la case et renvoie le menu.
export async function ouvrirMenuContextuel(page: Page, partie: number, n: number): Promise<Locator> {
  await caseN(page, partie, n).click({ button: 'right' });
  const menu = page.locator('#context-menu');
  await expect(menu).toBeVisible();
  return menu;
}

// Ouvre le menu d'une partie (bouton « … ») et renvoie le menu.
export async function ouvrirMenuPartie(page: Page, partie: number): Promise<Locator> {
  await page.locator('#progression-sections .prog-section-menu').nth(partie).click();
  const menu = page.locator('#partie-menu');
  await expect(menu).toBeVisible();
  return menu;
}

// Glisser-déposer à la souris d'une case sur une autre (fraction horizontale de la case cible : < 0,5 avant, > 0,5 après).
export async function glisserCase(page: Page, depuis: Locator, vers: Locator, fraction = 0.7) {
  const a = (await depuis.boundingBox())!, d = (await vers.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 30, a.y + a.height / 2, { steps: 4 });
  await page.mouse.move(d.x + d.width * fraction, d.y + d.height / 2, { steps: 12 });
  await page.mouse.up();
}

// L'appli demande confirmation (boîte native `confirm`) avant de supprimer un accord ou une partie ; Playwright refuse par défaut.
// Renvoie la liste des messages vus ; `reponse` = true (OK) ou false (Annuler).
export function repondreAuxConfirmations(page: Page, reponse = true): string[] {
  const messages: string[] = [];
  page.on('dialog', d => {
    if (d.type() === 'beforeunload') { void d.accept(); return; }
    messages.push(d.message());
    void (reponse ? d.accept() : d.dismiss());
  });
  return messages;
}

// Clic simple sur une case, puis attente que la sélection soit réellement posée (elle l'est quelques dizaines de ms après le clic, un peu
// plus tard sous Firefox) : un test qui enchaîne tout de suite un raccourci clavier (Ctrl+C / Ctrl+V / Suppr) irait plus vite que l'utilisateur.
export async function selectionner(page: Page, partie: number, n: number) {
  await caseN(page, partie, n).click();
  await expect(caseN(page, partie, n)).toHaveClass(/\bselected\b/);
}
// Ctrl+clic ou Maj+clic, puis attente que la case fasse partie du groupe.
export async function ajouterAuGroupe(page: Page, partie: number, n: number, touche: 'Control' | 'Shift') {
  await caseN(page, partie, n).click({ modifiers: [touche] });
  await expect(caseN(page, partie, n)).toHaveClass(/multi-selected/);
}
