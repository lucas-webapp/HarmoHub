// MODULE « grille » — sélection d'une case, sélection multiple (Ctrl/Cmd+clic, Maj+clic), barre « n accords sélectionnés », désélection.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, caseN, cases, noms, selectionnees, groupe, reglagesMorceau } from './aide-grille';

const barre = (page: import('@playwright/test').Page) => page.locator('#barre-selection');

test.describe('Sélection — ordinateur @grille @ordinateur', () => {
  test('un clic sélectionne une case, un clic sur une autre déplace la sélection @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(selectionnees(page)).toHaveCount(0);
    await caseN(page, 0, 1).click();
    await expect(selectionnees(page)).toHaveCount(1);
    await expect(selectionnees(page).first()).toContainText('Am');
    await expect(groupe(page)).toHaveCount(0);
    await caseN(page, 0, 3).click();
    await expect(selectionnees(page)).toHaveCount(1);
    await expect(selectionnees(page).first()).toContainText('G');
    expect(garde.bloquees).toEqual([]);
  });

  test('un clic dans le vide désélectionne', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 2).click();
    await expect(selectionnees(page)).toHaveCount(1);
    await page.mouse.click(150, 450);
    await expect(selectionnees(page)).toHaveCount(0);
  });

  test('la sélection ne modifie pas la grille (ni l\'ordre, ni les accords)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    for (const n of [0, 1, 2, 3]) await caseN(page, 0, n).click();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('Ctrl+clic ajoute des cases à la sélection, la barre dit combien @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 0).click();
    await caseN(page, 0, 2).click({ modifiers: ['Control'] });
    await expect(groupe(page)).toHaveCount(2);
    await expect(barre(page)).toBeVisible();
    await expect(barre(page)).toContainText('2 accords sélectionnés');
    await caseN(page, 0, 3).click({ modifiers: ['Control'] });
    await expect(groupe(page)).toHaveCount(3);
    await expect(barre(page)).toContainText('3 accords sélectionnés');
    await expect(groupe(page).nth(0)).toContainText('C');
    await expect(groupe(page).nth(1)).toContainText('F');
    await expect(groupe(page).nth(2)).toContainText('G');
  });

  test('Ctrl+clic sur une case du groupe la retire du groupe', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 0).click();
    await caseN(page, 0, 1).click({ modifiers: ['Control'] });
    await caseN(page, 0, 3).click({ modifiers: ['Control'] });
    await expect(groupe(page)).toHaveCount(3);
    await caseN(page, 0, 3).click({ modifiers: ['Control'] });
    await expect(groupe(page)).toHaveCount(2);
    await expect(barre(page)).toContainText('2 accords sélectionnés');
  });

  test('Maj+clic sélectionne toute la plage entre deux cases @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 0).click();
    await caseN(page, 0, 3).click({ modifiers: ['Shift'] });
    await expect(groupe(page)).toHaveCount(4);
    await expect(barre(page)).toContainText('4 accords sélectionnés');
  });

  test('un simple clic sur une case quitte la sélection multiple', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 0).click();
    await caseN(page, 0, 2).click({ modifiers: ['Shift'] });
    await expect(groupe(page)).toHaveCount(3);
    await caseN(page, 0, 3).click();
    await expect(groupe(page)).toHaveCount(0);
    await expect(selectionnees(page)).toHaveCount(1);
    await expect(barre(page)).toBeHidden();
  });

  test('Échap et « Tout désélectionner » vident la sélection multiple', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 0).click();
    await caseN(page, 0, 2).click({ modifiers: ['Shift'] });
    await expect(groupe(page)).toHaveCount(3);
    await page.keyboard.press('Escape');
    await expect(groupe(page)).toHaveCount(0);
    await caseN(page, 0, 0).click();
    await caseN(page, 0, 2).click({ modifiers: ['Shift'] });
    await expect(groupe(page)).toHaveCount(3);
    await barre(page).getByRole('button', { name: 'Tout désélectionner' }).click();
    await expect(groupe(page)).toHaveCount(0);
    await expect(barre(page)).toBeHidden();
  });

  // Défaut observé sous Firefox seulement (voir bugs.md) : le clic sur une case d'une AUTRE partie que la partie active ne fait que changer
  // la partie active ; il faut cliquer une seconde fois pour sélectionner la case. Chromium, Edge, WebKit et iPad : sélection du premier coup.
  test('un clic sur une case d\'une autre partie la sélectionne du premier coup', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: reglagesMorceau([
      { titre: 'Couplet', accords: C_AM_F_G }, { titre: 'Refrain', accords: [{ root: 'D', quality: 'min' }, { root: 'E', quality: 'min' }] },
    ]) });
    await caseN(page, 1, 0).click();   // la partie active au départ est la première
    await expect(selectionnees(page)).toHaveCount(1);
    await expect(selectionnees(page).first()).toContainText('Dm');
    await caseN(page, 0, 2).click();   // retour à la première partie
    await expect(selectionnees(page)).toHaveCount(1);
    await expect(selectionnees(page).first()).toContainText('F');
  });

  test('la sélection multiple fonctionne d\'une partie à l\'autre : chaque partie garde ses cases', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await page.getByRole('button', { name: 'Ajouter une section' }).click();
    const plus2 = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).nth(1);
    await plus2.fill('Dm//G'); await plus2.press('Enter');
    await caseN(page, 1, 0).click();
    await caseN(page, 1, 1).click({ modifiers: ['Shift'] });
    await expect(groupe(page)).toHaveCount(2);
    expect(await noms(page, 1)).toEqual(['Dm', 'G']);
    expect(await noms(page, 0)).toEqual(['C', 'Am', 'F', 'G']);
  });
});

test.describe('Sélection — téléphone @grille @mobile', () => {
  test('un toucher sélectionne une case, un toucher ailleurs la déplace @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(cases(page)).toHaveCount(4);
    await caseN(page, 0, 1).tap();
    await expect(selectionnees(page)).toHaveCount(1);
    await expect(selectionnees(page).first()).toContainText('Am');
    await caseN(page, 0, 2).tap();
    await expect(selectionnees(page)).toHaveCount(1);
    await expect(selectionnees(page).first()).toContainText('F');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });
});
