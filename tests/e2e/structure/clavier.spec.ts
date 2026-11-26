// MODULE « structure » — CLAVIER et petits défauts de la fenêtre (essai neutre du 25/11 : SN-04, SN-05, SN-09, SN-10, SN-14, SN-15, SN-16).
// Le clavier seul doit suffire pour arranger un morceau : le focus reste sur le bouton qu'on vient de presser (la liste est redessinée à chaque geste), Espace presse
// le bouton au lieu de lancer la lecture, et le menu d'une ligne s'ouvre (Maj+F10), se parcourt avec les flèches et se ferme avec Échap.
import { test, expect } from '../support/fixtures';
import {
  morceauTroisParties, ouvrirStructure, lire, titresLignes, repsLignes, plus, moins, monter, descendre, lignes, menuLigne, actionMenu, fenetre, ajoutPartie,
  champRenommer, dialogueRenommer, choisirAction, ajouterPartie, estMobile,
} from './aide-structure';

const focus = (page: import('@playwright/test').Page) =>
  page.evaluate(() => { const e = document.activeElement as HTMLElement | null; return e ? `${e.getAttribute('aria-label') || e.id || e.tagName}|${e.closest('.struct-row')?.getAttribute('data-item') ?? ''}` : ''; });

test.describe('Clavier et détails de la fenêtre @structure @ordinateur', () => {
  test.beforeEach(async ({}, info) => { test.skip(/mobile|iphone|tablette/i.test(info.project.name), 'gestes clavier : ordinateur'); });

  test('Entrée sur « ↓ » garde le focus sur ce bouton, sur la ligne où l\'occurrence est maintenant : trois crans sans retaper Tab @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await descendre(page, 0).focus();
    await page.keyboard.press('Enter');
    expect(await focus(page)).toBe('Descendre, Couplet|1');
    await page.keyboard.press('Enter');
    expect(await focus(page)).toBe('Monter, Couplet|2');                          // en bas, « ↓ » est grisé : le focus passe à son pendant, il ne se perd pas
    expect(await titresLignes(page)).toEqual(['Refrain', 'Pont', 'Couplet']);
    await page.keyboard.press('Enter');                                           // « ↑ » : le Couplet remonte, le focus le suit
    expect(await focus(page)).toBe('Monter, Couplet|1');
    expect(await titresLignes(page)).toEqual(['Refrain', 'Couplet', 'Pont']);
  });

  test('les boutons d\'une ligne disent de quelle partie ils parlent (nom accessible)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await expect(plus(page, 1)).toHaveAccessibleName('Une répétition de plus, Refrain');
    await expect(moins(page, 2)).toHaveAccessibleName('Une répétition de moins, Pont');
    await expect(monter(page, 1)).toHaveAccessibleName('Monter, Refrain');
    await expect(descendre(page, 0)).toHaveAccessibleName('Descendre, Couplet');
  });

  test('Entrée sur « + » et « − » garde le focus ; Espace presse le bouton et ne lance PAS la lecture', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await plus(page, 1).focus();
    await page.keyboard.press('Enter');
    expect(await focus(page)).toBe('Une répétition de plus, Refrain|1');
    await page.keyboard.press('Space');
    expect(await repsLignes(page)).toEqual(['', '×3', '']);
    expect(await page.evaluate(() => (window as any).app.isPlaying)).toBe(false);
    await moins(page, 1).focus();
    await page.keyboard.press('Space');
    expect(await repsLignes(page)).toEqual(['', '×2', '']);
    expect(await focus(page)).toBe('Une répétition de moins, Refrain|1');
  });

  test('Maj+F10 ouvre le menu de la ligne, prend le focus ; ↓ parcourt ; Entrée choisit ; la ligne visée est marquée (SN-05) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await plus(page, 1).focus();
    await page.keyboard.press('Shift+F10');
    await expect(menuLigne(page)).toBeVisible();
    await expect(lignes(page).nth(1)).toHaveClass(/struct-row-cible/);           // c'est le Refrain qui est visé
    await expect(lignes(page).nth(0)).not.toHaveClass(/struct-row-cible/);
    await expect(actionMenu(page, /^Dupliquer/)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(actionMenu(page, /^Renommer/)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(actionMenu(page, /^Dupliquer/)).toBeFocused();
    await page.keyboard.press('End');
    await expect(actionMenu(page, /^Supprimer/)).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');                                          // Dupliquer
    await expect(menuLigne(page)).toBeHidden();
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Refrain', 'Pont']);
  });

  test('Échap referme le menu et rend le focus au bouton d\'où il venait ; la fenêtre reste ouverte', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await monter(page, 2).focus();
    await page.keyboard.press('Shift+F10');
    await expect(menuLigne(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menuLigne(page)).toBeHidden();
    await expect(fenetre(page)).toBeVisible();
    expect(await focus(page)).toBe('Monter, Pont|2');
    await expect(lignes(page).nth(2)).not.toHaveClass(/struct-row-cible/);
  });

  test('« Renommer » sélectionne le nom : taper le remplace (SN-09)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 0, /^Renommer/);
    await expect(champRenommer(page)).toBeFocused();
    await page.keyboard.type('Couplet A');
    await expect(champRenommer(page)).toHaveValue('Couplet A');                  // pas « Couplet ACouplet »
    await page.keyboard.press('Enter');
    await expect(dialogueRenommer(page)).toBeHidden();
    expect(await titresLignes(page)).toEqual(['Couplet A', 'Refrain', 'Pont']);
  });

  test('structure vidée : une phrase explique et propose « + Partie… » (SN-16)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    for (let i = 0; i < 3; i++) await choisirAction(page, 0, /^Supprimer/);
    await expect(lignes(page)).toHaveCount(0);
    await expect(fenetre(page).getByText(/La structure est vide/)).toBeVisible();
    await expect(ajoutPartie(page)).toBeVisible();
  });

  test('un nom de 200 caractères sans espace reste dans sa ligne (SN-10)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 0, /^Renommer/);
    await champRenommer(page).fill('M'.repeat(200));
    await page.keyboard.press('Enter');
    const boite = async (s: string) => (await fenetre(page).locator(s).first().boundingBox())!;
    const ligne = await boite('.struct-row'), titre = await boite('.struct-title'), actions = await boite('.struct-actions');
    expect(titre.x + titre.width).toBeLessThanOrEqual(ligne.x + ligne.width + 1);   // il ne sort pas du cadre
    expect(titre.x + titre.width).toBeLessThanOrEqual(actions.x + 1);               // et ne passe pas sous les boutons
  });

  test('avec une longue liste, la partie qu\'on ajoute est amenée à l\'écran (SN-15)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    for (let i = 0; i < 14; i++) await ajouterPartie(page, /Pont/);
    await expect(lignes(page)).toHaveCount(17);
    await expect(lignes(page).last()).toBeInViewport();
  });
});
