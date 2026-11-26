// MODULE « structure » — grille et structure qui DIVERGENT (essai neutre du 25/11, SN-13). Une fois l'arrangement fait à la main, il ne suit plus la grille (c'est voulu) ;
// l'utilisateur doit le VOIR : les parties de la grille que la structure ne cite pas sont signalées, avec un bouton qui les y ajoute.
import { test, expect } from '../support/fixtures';
import {
  morceauTroisParties, ouvrirStructure, retourGrille, titresLignes, plus, appuyer, ouvrirMenuPartie, fenetre, lignes, ajoutPartie,
} from './aide-structure';

const bandeau = (page: import('@playwright/test').Page) => fenetre(page).locator('.struct-divergence');

test.describe('Parties de la grille absentes de la structure @structure', () => {
  test('sans arrangement (structure déduite de la grille), rien à signaler', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await expect(bandeau(page)).toHaveCount(0);
  });

  test('une partie dupliquée dans la grille APRÈS l\'arrangement est signalée ; « Ajouter » la met à la fin ; Ctrl+Z la ressort @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));                                // l'arrangement existe (Couplet ×2)
    await expect(bandeau(page)).toHaveCount(0);                        // et cite bien toutes les parties
    await retourGrille(page);
    const menu = await ouvrirMenuPartie(page, 1);
    await appuyer(page, menu.getByRole('menuitem', { name: 'Dupliquer' }));      // « Refrain (copie) » apparaît dans la grille
    await ouvrirStructure(page);
    await expect(bandeau(page)).toBeVisible();
    await expect(bandeau(page)).toContainText('Pas dans la structure');
    await expect(bandeau(page).locator('strong')).toHaveText('Refrain (copie)');
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    await appuyer(page, bandeau(page).getByRole('button', { name: 'Ajouter' }));
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont', 'Refrain (copie)']);
    await expect(bandeau(page)).toHaveCount(0);
    await page.keyboard.press('Control+z');
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    await expect(bandeau(page)).toBeVisible();
  });

  test('une partie retirée de la structure (ligne supprimée) est signalée, et le menu « + Partie… » la dit « pas encore utilisée »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await lignes(page).nth(2).click({ button: 'right' });
    await appuyer(page, page.locator('#struct-menu').getByRole('button', { name: /^Supprimer/ }));
    await expect(bandeau(page).locator('strong')).toHaveText('Pont');
    await expect(ajoutPartie(page).locator('option', { hasText: 'Pont' })).toContainText('pas encore utilisée');
  });
});
