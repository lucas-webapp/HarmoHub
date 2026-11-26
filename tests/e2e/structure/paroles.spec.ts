// MODULE « structure » — frontière avec PAROLES (essai neutre du 25/11, SN-07). Quand le morceau a une structure arrangée, le ×N d'une partie dans Paroles est la
// SOMME de ses passages dans la structure : il s'affiche, mais ne se règle plus ici (avant : il se réglait, ne touchait pas la structure et revenait seul à la valeur
// de la structure en quittant l'écran). Sans structure arrangée, rien ne change : le ×N se règle dans Paroles (P-08).
import { test, expect } from '../support/fixtures';
import { morceauTroisParties, ouvrirStructure, plus, choisirAction, appuyer, estMobile } from './aide-structure';
import { ongletParoles, ongletGrille, regionParoles, cadre, carte, repPlus, repMoins } from '../paroles/aide-paroles';
import type { Page } from '@playwright/test';

async function ouvrirParoles(page: Page) {
  await appuyer(page, ongletParoles(page));
  await expect(regionParoles(page)).toBeVisible();
  await expect(cadre(page).locator('.chord-chip').first()).toBeVisible();
}
const valeur = (page: Page, partie: number) => carte(page, partie).locator('.repeat-value');

test.describe('Paroles et structure arrangée @structure', () => {
  test('le total de passages est affiché (somme sur deux occurrences) mais ne se règle plus dans Paroles @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));                                      // Couplet ×2
    await choisirAction(page, 0, /^Dupliquer/);                              // et une seconde occurrence de Couplet (×2) : total 4
    await appuyer(page, ongletGrille(page));
    await ouvrirParoles(page);
    await expect(valeur(page, 0)).toHaveText('× 4');
    await expect(repPlus(page, 0)).toBeDisabled();
    await expect(repMoins(page, 0)).toBeDisabled();
    await expect(repPlus(page, 0)).toHaveAttribute('title', /Structure/);
    if (!estMobile(page)) await repPlus(page, 0).click({ force: true });     // même forcé, rien ne bouge
    await expect(valeur(page, 0)).toHaveText('× 4');
    await appuyer(page, ongletGrille(page));
    await ouvrirParoles(page);
    await expect(valeur(page, 0)).toHaveText('× 4');                         // et rien ne « revient seul » en quittant l'écran
  });

  test('sans structure arrangée, le ×N se règle toujours dans Paroles (P-08)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirParoles(page);
    await expect(repPlus(page, 0)).toBeEnabled();
    await appuyer(page, repPlus(page, 0));
    await expect(valeur(page, 0)).toHaveText('× 2');
  });
});
