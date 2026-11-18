// Aides communes aux specs du module « structure » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// La STRUCTURE est le plan de jeu du morceau : une suite d'« occurrences » de parties (chacune renvoie à une partie de la grille, avec un nombre de
// répétitions ×N, un nom d'affichage facultatif et des commentaires). Elle s'ouvre par l'onglet « Structure » de la barre du haut (ordinateur
// et téléphone : même fenêtre, `dialog` « Structure du morceau »). Ce n'est PAS l'ordre de la grille : monter / descendre / répéter ici ne touche
// pas la grille, et la lecture audio ne suit pas la structure (c'est un document de travail et d'impression, voir `docs/dette-tests.md`).
// Les lignes n'ont ni rôle ni `data-testid` : classes `struct-row`, `struct-title`, `struct-rep`… (à proposer en `data-testid`, voir le rapport).
import { expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import type { Accord } from '../support/appli';
import { reglagesMorceau, estMobile, caseN } from '../grille/aide-grille';
import { appuiLong } from '../mobile/aide-mobile';

export { C_AM_F_G, caseN, cases, noms, titres, titresParties, reglagesMorceau, estMobile, repondreAuxConfirmations, ouvrirMenuPartie } from '../grille/aide-grille';
export { telecharger, creerMorceau, etat, toast } from '../fichiers/aide-fichiers';
export { ouvrirTempo, fermerTempo, plusLent } from '../lecture/aide-lecture';

export const appuyer = (page: Page, l: Locator) => (estMobile(page) ? l.tap() : l.click());

// Qualités telles que l'appli les enregistre : '' = majeur, 'min' = mineur, 'dom7' = septième de dominante.
const C = (root: string, quality: string, beats: number): Accord => ({ root, quality, beats });
// Trois parties : « Couplet » 12 temps = 3 mesures (C | Am | F G), « Refrain » 16 temps = 4 mesures (F tenu deux mesures | C | G), « Pont » 8 temps = 2 mesures.
export const COUPLET: Accord[] = [C('C', '', 4), C('A', 'min', 4), C('F', '', 2), C('G', '', 2)];
export const REFRAIN: Accord[] = [C('F', '', 8), C('C', '', 4), C('G', '', 4)];
export const PONT: Accord[] = [C('D', 'min', 4), C('G', 'dom7', 4)];
export const PARTIES = [{ titre: 'Couplet', accords: COUPLET }, { titre: 'Refrain', accords: REFRAIN }, { titre: 'Pont', accords: PONT }];
export const morceauTroisParties = (parties = PARTIES, nom = 'Démo') => ({ reglages: reglagesMorceau(parties, nom) });

// ── La fenêtre ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const ongletStructure = (page: Page): Locator => page.getByRole('button', { name: 'Voir la structure du morceau' });
export const ongletGrille = (page: Page): Locator => page.getByRole('button', { name: 'Grille', exact: true });
export const fenetre = (page: Page): Locator => page.getByRole('dialog', { name: 'Structure du morceau' });
export const lignes = (page: Page): Locator => fenetre(page).locator('.struct-row');
export const ligne = (page: Page, n: number): Locator => lignes(page).nth(n);
export const menuLigne = (page: Page): Locator => page.locator('#struct-menu');
export const ajoutPartie = (page: Page): Locator => fenetre(page).getByRole('combobox', { name: 'Ajouter une partie à la structure' });
export const boutonApercu = (page: Page): Locator => fenetre(page).getByRole('button', { name: 'Aperçu / PDF' });

export async function ouvrirStructure(page: Page): Promise<Locator> {
  await appuyer(page, ongletStructure(page));
  await expect(fenetre(page)).toBeVisible();
  return fenetre(page);
}
export async function retourGrille(page: Page) {
  await appuyer(page, ongletGrille(page));
  await expect(fenetre(page)).toBeHidden();
}

// Ce que dit la fenêtre, tel que l'utilisateur le lit.
export type LigneLue = { titre: string; mesures: string; rep: string; position: string; accords: string; notes: string[] };
export type Lecture = { mesures: string; duree: string; parties: string; deroule: string; lignes: LigneLue[] };
export async function lire(page: Page): Promise<Lecture> {
  const f = fenetre(page);
  const somme = f.locator('.struct-somme > span');
  // Un morceau vide n'a ni déroulé ni position : on lit alors une chaîne vide (les tests disent explicitement ce qu'ils attendent).
  const texte = async (l: Locator) => ((await l.count()) ? ((await l.first().textContent()) || '') : '').replace(/\s+/g, ' ').trim();
  const deroule = (await texte(f.locator('.struct-deroule'))).replace(/^Déroulé\s*/i, '');
  const l: LigneLue[] = [];
  for (const r of await lignes(page).all()) {
    l.push({
      titre: await texte(r.locator('.struct-title')),
      mesures: await texte(r.locator('.struct-measures')),
      rep: await texte(r.locator('.struct-rep')),
      position: await texte(r.locator('.struct-pos')),
      accords: await texte(r.locator('.struct-chords')),
      notes: (await r.locator('.struct-note-texte').allTextContents()).map(t => t.trim()),
    });
  }
  return { mesures: await texte(somme.nth(0)), duree: await texte(somme.nth(1)), parties: await texte(somme.nth(2)), deroule, lignes: l };
}
export const titresLignes = async (page: Page): Promise<string[]> => (await lignes(page).locator('.struct-title').allTextContents()).map(t => t.trim());
export const repsLignes = async (page: Page): Promise<string[]> =>
  Promise.all((await lignes(page).all()).map(async r => ((await r.locator('.struct-rep').count()) ? ((await r.locator('.struct-rep').textContent()) || '').trim() : '')));

// Boutons − + ↑ ↓ d'une ligne.
export const moins = (page: Page, n: number): Locator => ligne(page, n).getByRole('button', { name: 'Une répétition de moins' });
export const plus = (page: Page, n: number): Locator => ligne(page, n).getByRole('button', { name: 'Une répétition de plus' });
export const monter = (page: Page, n: number): Locator => ligne(page, n).getByRole('button', { name: 'Monter' });
export const descendre = (page: Page, n: number): Locator => ligne(page, n).getByRole('button', { name: 'Descendre' });

// Menu de la ligne : clic droit (ordinateur) ou appui long (téléphone), comme l'invite la légende « Clic droit : options ».
export async function ouvrirMenu(page: Page, n: number): Promise<Locator> {
  if (estMobile(page)) await appuiLong(page, ligne(page, n).locator('.struct-title'));
  else await ligne(page, n).click({ button: 'right' });
  await expect(menuLigne(page)).toBeVisible();
  return menuLigne(page);
}
export const actionMenu = (page: Page, nom: string | RegExp): Locator => menuLigne(page).getByRole('button', { name: nom });
export async function choisirAction(page: Page, n: number, nom: string | RegExp) {
  await ouvrirMenu(page, n);
  await appuyer(page, actionMenu(page, nom));
  await expect(menuLigne(page)).toBeHidden();
}

// Fenêtres de saisie (renommer, commentaire).
export const dialogueRenommer = (page: Page): Locator => page.getByRole('dialog', { name: 'Renommer cette occurrence' });
export const champRenommer = (page: Page): Locator => dialogueRenommer(page).getByRole('textbox', { name: 'Nom affiché dans la structure' });
export const dialogueCommentaire = (page: Page): Locator => page.getByRole('dialog', { name: /^(Ajouter un commentaire|Modifier le commentaire)$/ });
export const champCommentaire = (page: Page): Locator => dialogueCommentaire(page).getByRole('textbox', { name: 'Commentaire' });

export async function renommer(page: Page, n: number, nom: string) {
  await choisirAction(page, n, /^Renommer/);
  await expect(champRenommer(page)).toBeVisible();
  await champRenommer(page).fill(nom);
  await appuyer(page, dialogueRenommer(page).getByRole('button', { name: 'Valider' }));
  await expect(dialogueRenommer(page)).toBeHidden();
}
export async function commenter(page: Page, n: number, texte: string) {
  await choisirAction(page, n, /^Ajouter un commentaire/);
  await expect(champCommentaire(page)).toBeVisible();
  await champCommentaire(page).fill(texte);
  await appuyer(page, dialogueCommentaire(page).getByRole('button', { name: 'Valider' }));
  await expect(dialogueCommentaire(page)).toBeHidden();
}
export async function ajouterPartie(page: Page, nom: string | RegExp) {
  const option = ajoutPartie(page).locator('option').filter({ hasText: nom }).first();
  await ajoutPartie(page).selectOption({ label: ((await option.textContent()) || '').trim() });
}

// Ce que l'appli a enregistré : la structure du morceau en cours (clé `myProgression`) et celle de la bibliothèque (`harmohubSongs`).
export type OccurrenceStockee = { id: string; sid: string; rep: number; label: string; notes: { texte: string }[] };
export const structureStockee = (page: Page): Promise<OccurrenceStockee[]> =>
  page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')!).structure || []);
export const structureDuMorceau = (page: Page): Promise<OccurrenceStockee[]> => page.evaluate(() => {
  const id = localStorage.getItem('harmohubCurrentSongId');
  const s = (JSON.parse(localStorage.getItem('harmohubSongs') || '[]') as any[]).find(x => x.id === id);
  return s?.structure || [];
});
export const sidsParties = (page: Page): Promise<string[]> =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('myProgression')!).sections as any[]).map(s => s.sid));

// Dans la grille : le badge « ×N » d'une partie (absent à ×1) et son nom.
export const badgeGrille = (page: Page, partie: number): Locator =>
  page.locator('#progression-sections .prog-section').nth(partie).getByText(/^×\d+$/);

// ── L'aperçu avant impression ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
export const apercu = (page: Page): Locator => page.getByRole('dialog', { name: 'Aperçu avant impression' });
export const pagesApercu = (page: Page): Locator => apercu(page).locator('.sf-page');
export const feuille = (page: Page): Locator => apercu(page).locator('#apercu-pages');   // le contenu du document, hors réglages
export async function ouvrirApercu(page: Page): Promise<Locator> {
  await appuyer(page, boutonApercu(page));
  await expect(apercu(page)).toBeVisible();
  await expect(pagesApercu(page).first()).toBeVisible();
  return apercu(page);
}
export const etatApercu = (page: Page): Locator => apercu(page).locator('#apercu-etat');
export const caseApercu = (page: Page, nom: string | RegExp): Locator => apercu(page).getByRole('checkbox', { name: nom });
