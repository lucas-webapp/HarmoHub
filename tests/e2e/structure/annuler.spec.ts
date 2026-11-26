// MODULE « structure » — ANNULER / RÉTABLIR (essai neutre du 25/11, SN-01 et SN-02).
// Avant : aucun geste de structure n'entrait dans l'historique ; Ctrl+Z défaisait en silence le dernier geste de GRILLE et, après un geste de
// structure, pouvait rendre toutes les lignes orphelines (« Partie supprimée »). Maintenant : un geste de structure = une étape d'annulation, et
// annuler ne touche jamais la grille ni les identités des parties.
import { test, expect } from '../support/fixtures';
import {
  ouvrirMenuPartie, repondreAuxConfirmations,
  morceauTroisParties, ouvrirStructure, retourGrille, lire, titresLignes, repsLignes, plus, moins, monter, descendre, appuyer, lignes,
  noms, estMobile, structureStockee, structureDuMorceau, choisirAction, renommer, commenter, ajouterPartie, boutonApercu,
} from './aide-structure';

const ajouterAccordEnFin = async (page: import('@playwright/test').Page, texte: string) => {
  const champ = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
  await champ.fill(texte); await champ.press('Enter');
};

test.describe('Annuler et rétablir la structure @structure', () => {
  const surOrdinateur = (page: import('@playwright/test').Page) => test.skip(estMobile(page), 'le champ « Ajouter un accord à la fin » est celui de l\'ordinateur ; Ctrl+Z / Ctrl+Y sont les mêmes partout, voir les autres tests');
  test('SN-02 : un geste de grille, un geste de structure, Ctrl+Z → les lignes gardent leurs parties @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    surOrdinateur(page);
    await ajouterAccordEnFin(page, 'Em');                        // geste de GRILLE d'abord (c'est ce qui arme le piège)
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));                          // premier geste de structure
    await page.keyboard.press('Control+z');
    await retourGrille(page);
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);   // jamais « Partie supprimée »
    expect((await lire(page)).mesures).not.toBe('0 mesures');
  });

  test('SN-01 : Ctrl+Z défait le dernier geste de structure, Ctrl+Y le rejoue, la grille ne bouge pas @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    const grilleAvant = await noms(page);
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await expect(lignes(page).first().locator('.struct-rep')).toHaveText('×2');
    await page.keyboard.press('Control+z');
    await expect(lignes(page).first().locator('.struct-rep')).toHaveCount(0);   // la fenêtre montre l'annulation, sans aller-retour
    expect(await repsLignes(page)).toEqual(['', '', '']);
    expect((await structureStockee(page)).every(o => o.rep === 1)).toBe(true);   // retour à « déduite de la grille » (vide) ou à ×1
    await page.keyboard.press('Control+y');
    await expect(lignes(page).first().locator('.struct-rep')).toHaveText('×2');
    await retourGrille(page);
    expect(await noms(page)).toEqual(grilleAvant);
  });

  test('le bouton Annuler / Rétablir de la barre du haut fait la même chose que Ctrl+Z / Ctrl+Y', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 1));
    await expect(lignes(page).nth(1).locator('.struct-rep')).toHaveText('×2');
    await page.locator('#global-undo-btn').click();
    await expect(lignes(page).nth(1).locator('.struct-rep')).toHaveCount(0);
    await page.locator('#global-redo-btn').click();
    await expect(lignes(page).nth(1).locator('.struct-rep')).toHaveText('×2');
  });

  test('chaque geste (↑, ↓, +, −, dupliquer, supprimer, renommer, commenter, ajouter) s\'annule d\'un cran et se rétablit', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    // Une seule lecture de la page par état (et non une requête par ligne) : sous charge, Firefox dépassait le délai avec `lire`.
    const lireVite = () => page.evaluate(() => ({
      lignes: [...document.querySelectorAll('#structure-panel .struct-row')].map(r => [r.querySelector('.struct-title')?.textContent?.trim(), r.querySelector('.struct-rep')?.textContent?.trim() || '', [...r.querySelectorAll('.struct-note-texte')].map(n => n.textContent?.trim()).join('|')]),
      deroule: document.querySelector('#structure-panel .struct-deroule')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    }));
    const etats: Awaited<ReturnType<typeof lireVite>>[] = [await lireVite()];
    const geste = async (fait: () => Promise<void>) => { await fait(); etats.push(await lireVite()); };
    await geste(() => appuyer(page, monter(page, 1)));                    // Refrain en tête
    await geste(() => appuyer(page, descendre(page, 0)));                 // et il redescend
    await geste(() => appuyer(page, plus(page, 2)));                      // Pont ×2
    await geste(() => appuyer(page, plus(page, 2)));                      // Pont ×3
    await geste(() => appuyer(page, moins(page, 2)));                     // Pont ×2
    await geste(() => choisirAction(page, 0, /^Dupliquer/));              // Couplet, Couplet
    await geste(() => renommer(page, 1, 'Couplet bis'));
    await geste(() => commenter(page, 1, 'batterie seule'));
    await geste(() => ajouterPartie(page, /Refrain/));
    await geste(() => choisirAction(page, 0, /^Supprimer/));
    // Chaque annulation redonne l'état précédent, dans la fenêtre ET dans le morceau enregistré.
    for (let i = etats.length - 2; i >= 0; i--) {
      await page.keyboard.press('Control+z');
      expect(await lireVite(), `après ${etats.length - 1 - i} annulation(s)`).toEqual(etats[i]);
    }
    await expect(page.locator('#global-undo-btn')).toBeDisabled();       // plus rien à annuler : on est revenu au point de départ
    for (let i = 1; i < etats.length; i++) {
      await page.keyboard.press('Control+y');
      expect(await lireVite(), `après ${i} rétablissement(s)`).toEqual(etats[i]);
    }
  });

  test('l\'annulation de la structure rejoint le morceau enregistré (export, synchro) sans « Enregistrer »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    expect((await structureDuMorceau(page)).map(o => o.rep)).toEqual([2, 1, 1]);
    await page.keyboard.press('Control+z');
    expect((await structureDuMorceau(page)).every(o => o.rep === 1)).toBe(true);
    await page.keyboard.press('Control+y');
    expect((await structureDuMorceau(page)).map(o => o.rep)).toEqual([2, 1, 1]);
  });

  test('un geste qui ne change rien (− à ×1) ne crée pas d\'étape d\'annulation ; ↑ de la première ligne est grisé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await expect(monter(page, 0)).toBeDisabled();
    await appuyer(page, moins(page, 1));
    await expect(page.locator('#global-undo-btn')).toBeDisabled();
  });

  test('un geste de grille APRÈS l\'arrangement : Ctrl+Z ne défait que ce geste, l\'arrangement reste', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    surOrdinateur(page);
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await retourGrille(page);
    const avant = await noms(page);
    await ajouterAccordEnFin(page, 'Em');
    expect(await noms(page)).not.toEqual(avant);
    await page.locator('#global-undo-btn').click();                       // le focus est encore dans le champ d'ajout : Ctrl+Z y défairait la frappe
    expect(await noms(page)).toEqual(avant);
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    expect(await repsLignes(page)).toEqual(['×2', '', '']);
  });

  test('supprimer une partie DANS LA GRILLE puis Ctrl+Z : la partie et ses passages reviennent ensemble', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));                                 // Couplet ×2 : l'arrangement existe
    await retourGrille(page);
    repondreAuxConfirmations(page);
    const menu = await ouvrirMenuPartie(page, 0);
    await appuyer(page, menu.getByRole('menuitem', { name: 'Supprimer la partie' }));
    await ouvrirStructure(page);
    await expect(lignes(page).first()).toHaveClass(/struct-orpheline/);        // la ligne garde son nom mais est barrée (SN-08)
    await page.keyboard.press('Control+z');
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    expect(await repsLignes(page)).toEqual(['×2', '', '']);
  });
});
