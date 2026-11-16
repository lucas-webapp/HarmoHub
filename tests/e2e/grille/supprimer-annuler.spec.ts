// MODULE « grille » — supprimer (touche Suppr, barre de sélection, menu du clic droit), annuler / rétablir (boutons de la barre du haut et Ctrl+Z / Ctrl+Maj+Z).
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, caseN, cases, noms, ouvrirMenuContextuel, cliquerPlusAvant, saisirAjoutRapide, titres, ouvrirMenuPartie, repondreAuxConfirmations, selectionner, ajouterAuGroupe } from './aide-grille';

const annuler = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Annuler', exact: true });
const retablir = (page: import('@playwright/test').Page) => page.getByRole('button', { name: 'Rétablir', exact: true });

test.describe('Supprimer — ordinateur @grille @ordinateur', () => {
  test('la touche Suppr supprime la case sélectionnée @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 1);
    await page.keyboard.press('Delete');
    expect(await noms(page)).toEqual(['C', 'F', 'G']);
    await expect(cases(page)).toHaveCount(3);
    expect(garde.bloquees).toEqual([]);
  });

  test('Suppr sans sélection ne supprime rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await page.keyboard.press('Delete');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('Suppr supprime tout le groupe sélectionné (Maj+clic)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 1);
    await ajouterAuGroupe(page, 0, 2, 'Shift');
    await page.keyboard.press('Delete');
    expect(await noms(page)).toEqual(['C', 'G']);
  });

  test('le bouton « Supprimer » de la barre de sélection supprime les accords choisis (Ctrl+clic)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 0);
    await ajouterAuGroupe(page, 0, 3, 'Control');
    await page.locator('#barre-selection').getByRole('button', { name: 'Supprimer' }).click();
    expect(await noms(page)).toEqual(['Am', 'F']);
    await expect(page.locator('#barre-selection')).toBeHidden();
  });

  test('« Supprimer » du menu du clic droit supprime la case visée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const messages = repondreAuxConfirmations(page, true);
    const menu = await ouvrirMenuContextuel(page, 0, 2);
    await menu.getByText('Supprimer', { exact: true }).click();
    await expect.poll(() => messages).toEqual(['Supprimer cet accord ?']);
    expect(await noms(page)).toEqual(['C', 'Am', 'G']);
    await expect(page.locator('#context-menu')).toBeHidden();
  });

  test('« Supprimer » du menu du clic droit demande confirmation : refuser garde l\'accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const messages = repondreAuxConfirmations(page, false);
    const menu = await ouvrirMenuContextuel(page, 0, 2);
    await menu.getByText('Supprimer', { exact: true }).click();
    await expect.poll(() => messages).toEqual(['Supprimer cet accord ?']);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('on peut supprimer tous les accords : la partie reste, avec sa case « + »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '' }] });
    await selectionner(page, 0, 0);
    await page.keyboard.press('Delete');
    await expect(cases(page)).toHaveCount(0);
    await expect(page.locator('#progression-sections .prog-section')).toHaveCount(1);
    await expect(page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' })).toBeVisible();
  });
});

test.describe('Annuler / rétablir — ordinateur @grille @ordinateur', () => {
  test('au départ, Annuler et Rétablir sont désactivés ; une suppression active Annuler @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(annuler(page)).toBeDisabled();
    await expect(retablir(page)).toBeDisabled();
    await selectionner(page, 0, 1);
    await page.keyboard.press('Delete');
    await expect(annuler(page)).toBeEnabled();
    await expect(retablir(page)).toBeDisabled();
  });

  test('le bouton Annuler restaure la case, le bouton Rétablir la supprime de nouveau @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 1);
    await page.keyboard.press('Delete');
    expect(await noms(page)).toEqual(['C', 'F', 'G']);
    await annuler(page).click();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(retablir(page)).toBeEnabled();
    await retablir(page).click();
    expect(await noms(page)).toEqual(['C', 'F', 'G']);
    await expect(retablir(page)).toBeDisabled();
  });

  test('Ctrl+Z et Ctrl+Maj+Z défont et refont, plusieurs fois d\'affilée @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const plus = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
    await plus.fill('Em'); await plus.press('Enter');              // 1. ajout
    await selectionner(page, 0, 0);
    await page.keyboard.press('Delete');                           // 2. suppression de C
    await caseN(page, 0, 0).click({ button: 'right' });            // 3. duplication
    await page.locator('#context-menu').getByText('Dupliquer').click();
    expect(await noms(page)).toEqual(['Am', 'Am', 'F', 'G', 'Em']);
    await page.keyboard.press('Control+z');
    expect(await noms(page)).toEqual(['Am', 'F', 'G', 'Em']);
    await page.keyboard.press('Control+z');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'Em']);
    await page.keyboard.press('Control+z');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(annuler(page)).toBeDisabled();
    await page.keyboard.press('Control+Shift+z');
    await page.keyboard.press('Control+Shift+z');
    expect(await noms(page)).toEqual(['Am', 'F', 'G', 'Em']);
  });

  test('une nouvelle action après un Annuler efface la possibilité de Rétablir', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 1);
    await page.keyboard.press('Delete');
    await annuler(page).click();
    await expect(retablir(page)).toBeEnabled();
    await selectionner(page, 0, 3);
    await page.keyboard.press('Delete');
    await expect(retablir(page)).toBeDisabled();
    expect(await noms(page)).toEqual(['C', 'Am', 'F']);
  });

  test('l\'ajout par le panneau d\'ajout rapide est annulé en un seul Annuler', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await cliquerPlusAvant(page, 0, 1);
    await saisirAjoutRapide(page, 'Dm//Em//Bdim');
    expect(await noms(page)).toEqual(['C', 'Dm', 'Em', 'Bdim', 'Am', 'F', 'G']);
    await page.keyboard.press('Escape');
    await annuler(page).click();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('annuler la suppression d\'une partie la restaure avec ses accords et son titre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await page.getByRole('button', { name: 'Ajouter une section' }).click();
    await expect(page.locator('#progression-sections .prog-section')).toHaveCount(2);
    const messages = repondreAuxConfirmations(page, true);
    const menu = await ouvrirMenuPartie(page, 0);
    await menu.getByRole('menuitem', { name: 'Supprimer la partie' }).click();
    await expect.poll(() => messages).toEqual(['Supprimer « Couplet » et ses 4 accord(s) ?']);
    await expect(page.locator('#progression-sections .prog-section')).toHaveCount(1);
    await annuler(page).click();
    await expect(page.locator('#progression-sections .prog-section')).toHaveCount(2);
    expect(await noms(page, 0)).toEqual(['C', 'Am', 'F', 'G']);
    expect((await titres(page))[0]).toBe('Couplet');
  });
});

test.describe('Annuler / rétablir — téléphone @grille @mobile', () => {
  test('les boutons Annuler et Rétablir défont et refont un ajout @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(annuler(page)).toBeDisabled();
    await page.locator('.prog-section-ajout').first().tap();
    await page.locator('#quick-add-input').fill('Em//Bdim');
    await page.locator('#quick-add-btn').tap();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'Em', 'Bdim']);
    await page.keyboard.press('Escape');
    await expect(annuler(page)).toBeEnabled();
    await annuler(page).tap();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(retablir(page)).toBeEnabled();
    await retablir(page).tap();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'Em', 'Bdim']);
  });
});
