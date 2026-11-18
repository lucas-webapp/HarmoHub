// Aides communes aux specs du module « tonalite » (ce n'est pas une spec : le nom ne finit pas par .spec.ts).
// La tonalité est une RÉFÉRENCE : elle ne change que la lecture des degrés (chiffres romains au-dessus des cases) et l'écriture des dièses et
// bémols ; elle ne déplace aucun accord. « Transposer » (flèches bas / haut) déplace au contraire tous les accords d'un demi-ton ET la tonalité.
//   Ordinateur : la puce « Tonalité » (#rr-tonalite) est dans la barre des réglages du morceau.
//   Téléphone  : elle est dans le panneau que déplie la ligne de résumé (#song-summary) ; la fenêtre de choix est la même.
import { expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';   // types seulement : `test` et `expect` viennent toujours de la fixture
import { estMobile } from '../grille/aide-grille';

export { C_AM_F_G, caseN, cases, noms, estMobile, reglagesMorceau } from '../grille/aide-grille';
export { titre, etat, boutonEnregistrer, enregistrerSous, creerMorceau, repondreAuxBoitesNatives } from '../fichiers/aide-fichiers';

export const appuyer = (page: Page, l: Locator) => (estMobile(page) ? l.tap() : l.click());

export const puce = (page: Page): Locator => page.locator('#rr-tonalite');
export const fenetre = (page: Page): Locator => page.getByRole('dialog', { name: 'Tonalité de référence' });
export const menuSuggestion = (page: Page): Locator => page.locator('#key-suggest-menu');
export const boutonSuggerer = (page: Page): Locator => fenetre(page).getByRole('button', { name: /^Suggérer/ });
export const transposerHaut = (page: Page): Locator => page.getByRole('button', { name: 'Transposer tout le morceau vers le haut' });
export const transposerBas = (page: Page): Locator => page.getByRole('button', { name: 'Transposer tout le morceau vers le bas' });

export const TONIQUES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
export const MODES: [string, string][] = [['Maj', 'Majeur'], ['Min', 'Mineur'], ['Dor', 'Dorien'], ['Phr', 'Phrygien'], ['Lyd', 'Lydien'], ['Mix', 'Mixolydien'], ['Loc', 'Locrien']];

// Au téléphone, les réglages du morceau sont repliés derrière la ligne de résumé : on la déplie si besoin (comme l'utilisateur).
export async function ouvrirReglages(page: Page) {
  if (estMobile(page) && !(await puce(page).isVisible())) {
    await page.locator('#song-summary').tap();
    await expect(puce(page)).toBeVisible();
  }
}
export async function ouvrirTonalite(page: Page): Promise<Locator> {
  await ouvrirReglages(page);
  await appuyer(page, puce(page));
  await expect(fenetre(page)).toBeVisible();
  return fenetre(page);
}
export const boutonTonique = (page: Page, nom: string): Locator => fenetre(page).getByRole('button', { name: nom, exact: true });
export const boutonMode = (page: Page, nom: string): Locator => fenetre(page).getByRole('button', { name: nom, exact: true });   // « Majeur », « Dorien »…

// Choisit tonique et/ou mode dans la fenêtre (qu'elle ouvre si besoin) ; la fenêtre reste ouverte.
export async function choisir(page: Page, tonique?: string, mode?: string) {
  if (!(await fenetre(page).isVisible())) await ouvrirTonalite(page);
  if (tonique) { await appuyer(page, boutonTonique(page, tonique)); await expect(boutonTonique(page, tonique)).toHaveAttribute('aria-pressed', 'true'); }
  if (mode) { await appuyer(page, boutonMode(page, mode)); await expect(boutonMode(page, mode)).toHaveAttribute('aria-pressed', 'true'); }
}
// Ferme la fenêtre comme l'utilisateur : Échap (ordinateur) ; au téléphone, un toucher à côté.
export async function fermerFenetre(page: Page) {
  if (estMobile(page)) await page.locator('#progression-sections').tap({ position: { x: 5, y: 5 } });
  else await page.keyboard.press('Escape');
  await expect(fenetre(page)).toBeHidden();
}

// La tonalité telle que l'appli la dit : « D dorien » (résumé du morceau, `#song-summary-key`, présent à l'ordinateur comme au téléphone ;
// l'infobulle de la puce dit « Tonalité : D dorien — … » à l'ordinateur seulement).
// Le résumé écrit « F# majeur » avec un dièse ASCII là où la fenêtre et la puce écrivent « F♯ » : on le ramène à « ♯ » ici (écart noté T-01, bugs.md ;
// `libelleBrut` donne le texte tel quel pour le test qui le constate).
export const libelleBrut = async (page: Page): Promise<string> => ((await page.locator('#song-summary-key').textContent()) || '').trim();
export async function libelle(page: Page): Promise<string> {
  return (await libelleBrut(page)).replace('#', '♯');
}
// Les degrés (chiffres romains) affichés au-dessus des cases, dans l'ordre. Pas de `data-testid` : classe `row-roman`.
export const degres = (page: Page): Promise<string[]> =>
  page.locator('#progression-sections .row-roman').allTextContents().then(l => l.map(t => t.trim()));

// La tonalité enregistrée dans le morceau courant (stockage local ; écrite à « Enregistrer » seulement) : tonique (« D# »…) et mode (« maj », « dor »…).
export const tonaliteStockee = (page: Page): Promise<{ root: string; mode: string }> => page.evaluate(() => {
  const id = localStorage.getItem('harmohubCurrentSongId');
  const s = (JSON.parse(localStorage.getItem('harmohubSongs') || '[]') as any[]).find(x => x.id === id)!;
  return { root: s.root, mode: s.mode };
});
// Les fondamentales telles que l'appli les enregistre dans le morceau en cours (toujours avec des dièses : « D# », jamais « Eb »).
export const racinesStockees = (page: Page): Promise<string[]> => page.evaluate(() =>
  (JSON.parse(localStorage.getItem('myProgression')!).sections as any[]).flatMap(s => s.chords.map((c: any) => c.root)));

// Ajoute des accords en les TAPANT, comme l'utilisateur : « C//Am//F » (séparateur « // »). Ordinateur : la case « + » de fin de partie ;
// téléphone : « + Accord » de l'en-tête de partie, puis le bouton du panneau d'ajout.
export async function taper(page: Page, texte: string) {
  if (estMobile(page)) {
    await page.locator('.prog-section-ajout').first().tap();
    const saisie = page.locator('#quick-add-input');
    await expect(saisie).toBeVisible();
    await saisie.fill(texte);
    await page.locator('#quick-add-btn').tap();
    await expect(saisie).toHaveValue('');
  } else {
    const champ = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
    await champ.fill(texte);
    await champ.press('Enter');
    await expect(champ).toHaveValue('');
  }
}
export const DOUZE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(r => ({ root: r, quality: '' }));
