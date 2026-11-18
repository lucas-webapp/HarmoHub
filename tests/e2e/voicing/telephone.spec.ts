// MODULE « voicing » — au téléphone (< 900 px) la conduite des voix n'a pas de bouton ni de fenêtre : le voicing s'y règle dans l'onglet « Voicing »
// de la feuille d'accord (voir accord/telephone.spec.ts). Ces tests gardent que la fenêtre de l'ordinateur ne s'invite pas sur le téléphone, et qu'elle
// apparaît bien quand l'écran devient assez large (téléphone tenu en paysage).
import { test, expect } from '../support/fixtures';
import { morceauQuatreParties, bouton, popover, notes, titre, ouvrirFenetre, choisirOnglet, caseN } from './aide-voicing';

test.describe('Conduite des voix au téléphone @voicing @mobile', () => {
  test('le bouton « Voicing » n\'est pas affiché et la fenêtre reste fermée @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await expect(page.locator('#progression-sections')).toBeVisible();
    await expect(bouton(page)).toBeHidden();
    await expect(popover(page)).toBeHidden();
    await expect(page.getByRole('button', { name: 'Voicing', exact: true })).toBeHidden();
  });

  test('toucher une case, ou la double-toucher pour ouvrir la feuille d\'accord, n\'ouvre pas la fenêtre de l\'ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await caseN(page, 0, 1).tap();
    await expect(popover(page)).toBeHidden();
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');                          // l'onglet « Voicing » de la feuille, lui, existe bien
    await expect(f.getByRole('group', { name: 'Octave' })).toBeVisible();
    await expect(popover(page)).toBeHidden();
    await expect(bouton(page)).toBeHidden();
  });

  test('l\'écran élargi à 1000 px (téléphone en paysage) montre le bouton ; il ouvre la fenêtre et un nouveau toucher la ferme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await page.setViewportSize({ width: 1000, height: 500 });
    await expect(bouton(page)).toBeVisible();
    await bouton(page).tap();
    await expect(popover(page)).toBeVisible();
    await expect(titre(page)).toHaveText('Couplet');
    await expect(notes(page)).toHaveCount(16);
    const p = (await popover(page).boundingBox())!;
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x + p.width).toBeLessThanOrEqual(1000);
    expect(p.y + p.height).toBeLessThanOrEqual(500);
    await bouton(page).tap();
    await expect(popover(page)).toBeHidden();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(bouton(page)).toBeHidden();
  });
});
