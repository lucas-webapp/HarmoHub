// MODULE « grille » — menu du clic droit sur une case (ordinateur) : copier / coller, insérer avant / après, modifier / renommer, dupliquer,
// octave, supprimer. Au téléphone le même menu s'ouvre par un appui long (non testé ici : Playwright n'a pas d'appui long natif, voir rapport).
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, caseN, noms, selectionnees, ouvrirMenuContextuel, repondreAuxConfirmations } from './aide-grille';

const meta = (page: import('@playwright/test').Page, n: number) => caseN(page, 0, n).locator('.cell-meta');

test.describe('Menu du clic droit @grille @ordinateur', () => {
  test('un clic droit sur une case ouvre le menu des actions d\'accord @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const menu = await ouvrirMenuContextuel(page, 0, 1);
    for (const entree of ['Copier', 'Insérer avant…', 'Insérer après…', 'Modifier', 'Renommer', 'Dupliquer', 'Octave +1', 'Octave -1', 'Supprimer']) {
      await expect(menu.getByText(entree, { exact: true })).toBeVisible();
    }
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);   // ouvrir le menu ne change rien
    expect(garde.bloquees).toEqual([]);
  });

  test('« Dupliquer » recopie la case juste après elle @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const menu = await ouvrirMenuContextuel(page, 0, 1);
    await menu.getByText('Dupliquer', { exact: true }).click();
    expect(await noms(page)).toEqual(['C', 'Am', 'Am', 'F', 'G']);
    await expect(page.locator('#context-menu')).toBeHidden();
  });

  test('« Octave +1 » puis « Octave -1 » changent l\'octave de la case visée seulement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 2).click();   // une autre case est sélectionnée : le menu doit viser la case cliquée
    let menu = await ouvrirMenuContextuel(page, 0, 0);
    await menu.getByText('Octave +1', { exact: true }).click();
    await expect(meta(page, 0)).toHaveText('O4');
    await expect(meta(page, 2)).toHaveText('O3');
    menu = await ouvrirMenuContextuel(page, 0, 1);
    await menu.getByText('Octave -1', { exact: true }).click();
    await expect(meta(page, 1)).toHaveText('O2');
    await expect(meta(page, 0)).toHaveText('O4');
  });

  test('« Renommer » ouvre le champ du nom : taper Dm7 puis Entrée renomme l\'accord @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const menu = await ouvrirMenuContextuel(page, 0, 1);
    await menu.getByText('Renommer', { exact: true }).click();
    const champ = caseN(page, 0, 1).locator('input.cell-sym-input');
    await expect(champ).toBeFocused();
    await expect(champ).toHaveValue('Am');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Dm7');
    await page.keyboard.press('Enter');
    expect(await noms(page)).toEqual(['C', 'Dm7', 'F', 'G']);
  });

  test('Échap pendant le renommage laisse l\'accord inchangé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const menu = await ouvrirMenuContextuel(page, 0, 1);
    await menu.getByText('Renommer', { exact: true }).click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Gm');
    await page.keyboard.press('Escape');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('« Insérer avant… » et « Insérer après… » ouvrent le panneau d\'ajout sur la bonne destination', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    let menu = await ouvrirMenuContextuel(page, 0, 1);
    await menu.getByText('Insérer avant…', { exact: true }).click();
    await expect(page.locator('#quick-add-panel')).toContainText('avant Am (après C)');
    await page.keyboard.press('Escape');
    await expect(page.locator('#quick-add-input')).toBeHidden();
    menu = await ouvrirMenuContextuel(page, 0, 1);
    await menu.getByText('Insérer après…', { exact: true }).click();
    await expect(page.locator('#quick-add-panel')).toContainText('avant F (après Am)');
    await page.locator('#quick-add-input').fill('Em');
    await page.locator('#quick-add-btn').click();
    expect(await noms(page)).toEqual(['C', 'Am', 'Em', 'F', 'G']);
  });

  test('« Supprimer » demande confirmation puis retire la case @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const messages = repondreAuxConfirmations(page, true);
    const menu = await ouvrirMenuContextuel(page, 0, 3);
    await menu.getByText('Supprimer', { exact: true }).click();
    await expect.poll(() => messages).toEqual(['Supprimer cet accord ?']);
    expect(await noms(page)).toEqual(['C', 'Am', 'F']);
  });

  test('Échap et un clic ailleurs ferment le menu sans rien changer', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirMenuContextuel(page, 0, 1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#context-menu')).toBeHidden();
    await ouvrirMenuContextuel(page, 0, 2);
    await page.mouse.click(120, 520);
    await expect(page.locator('#context-menu')).toBeHidden();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('le menu est entièrement visible dans la fenêtre, même pour la dernière case', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const menu = await ouvrirMenuContextuel(page, 0, 3);
    const b = (await menu.boundingBox())!;
    const v = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(v.width);
    expect(b.y + b.height).toBeLessThanOrEqual(v.height);
  });

  test('le clic droit ne change pas la sélection en cours', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 2).click();
    await ouvrirMenuContextuel(page, 0, 0);
    await page.keyboard.press('Escape');
    await expect(selectionnees(page)).toHaveCount(1);
    await expect(selectionnees(page).first()).toContainText('F');
  });
});
