// MODULE « grille » — copier / coller : Ctrl+C / Ctrl+V, barre de sélection (Copier, Dupliquer), menu du clic droit (« Copier », « Coller après »).
// Règle observée : le collage insère DERRIÈRE la case cliquée et sélectionne ce qui vient d'être collé.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, caseN, noms, selectionnees, groupe, ouvrirMenuContextuel, reglagesMorceau, selectionner, ajouterAuGroupe } from './aide-grille';

const barre = (page: import('@playwright/test').Page) => page.locator('#barre-selection');

test.describe('Copier / coller — ordinateur @grille @ordinateur', () => {
  test('Ctrl+C puis Ctrl+V colle l\'accord derrière la case choisie, et le sélectionne @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 0);
    await page.keyboard.press('Control+c');
    await selectionner(page, 0, 1);
    await page.keyboard.press('Control+v');
    expect(await noms(page)).toEqual(['C', 'Am', 'C', 'F', 'G']);
    await expect(selectionnees(page)).toHaveCount(1);
    await expect(selectionnees(page).first()).toContainText('C');
    expect(garde.bloquees).toEqual([]);
  });

  test('un second Ctrl+V colle une deuxième fois, et chaque collage est annulable un par un @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 0);
    await page.keyboard.press('Control+c');
    await selectionner(page, 0, 1);
    await page.keyboard.press('Control+v');
    await page.keyboard.press('Control+v');
    expect(await noms(page)).toEqual(['C', 'Am', 'C', 'C', 'F', 'G']);
    await page.keyboard.press('Control+z');
    expect(await noms(page)).toEqual(['C', 'Am', 'C', 'F', 'G']);
    await page.keyboard.press('Control+z');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('plusieurs accords copiés (Ctrl+clic) sont collés ensemble, dans leur ordre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 1);
    await ajouterAuGroupe(page, 0, 2, 'Control');
    await page.keyboard.press('Control+c');
    await selectionner(page, 0, 3);
    await page.keyboard.press('Control+v');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'Am', 'F']);
  });

  test('copier ne modifie pas la grille et le presse-papiers survit à une autre sélection', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 2);
    await page.keyboard.press('Control+c');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await selectionner(page, 0, 0);
    await selectionner(page, 0, 1);
    await page.keyboard.press('Control+v');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'F', 'G']);
  });

  test('le bouton « Copier » de la barre de sélection puis Ctrl+V colle les accords', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 1);
    await ajouterAuGroupe(page, 0, 2, 'Shift');
    await barre(page).getByRole('button', { name: 'Copier' }).click();
    await selectionner(page, 0, 3);
    await page.keyboard.press('Control+v');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'Am', 'F']);
  });

  test('« Dupliquer » de la barre recopie la sélection juste après elle, annulable', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await selectionner(page, 0, 0);
    await ajouterAuGroupe(page, 0, 1, 'Shift');
    await barre(page).getByRole('button', { name: 'Dupliquer' }).click();
    expect(await noms(page)).toEqual(['C', 'Am', 'C', 'Am', 'F', 'G']);
    await page.keyboard.press('Control+z');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('menu du clic droit : « Copier » puis « Coller après » sur une autre case', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    let menu = await ouvrirMenuContextuel(page, 0, 2);
    await expect(menu.getByText('Coller après')).toBeHidden();   // rien à coller tant qu'on n'a rien copié
    await menu.getByText('Copier', { exact: true }).click();
    menu = await ouvrirMenuContextuel(page, 0, 0);
    await expect(menu.getByText('Coller après')).toBeVisible();
    await menu.getByText('Coller après').click();
    expect(await noms(page)).toEqual(['C', 'F', 'Am', 'F', 'G']);
  });

  test('on peut coller dans une autre partie sans toucher à la première', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: reglagesMorceau([
      { titre: 'Couplet', accords: C_AM_F_G }, { titre: 'Refrain', accords: [{ root: 'D', quality: 'min' }, { root: 'E', quality: 'min' }] },
    ]) });
    await selectionner(page, 0, 3);
    await page.keyboard.press('Control+c');
    await selectionner(page, 1, 0);
    await page.keyboard.press('Control+v');
    expect(await noms(page, 1)).toEqual(['Dm', 'G', 'Em']);
    expect(await noms(page, 0)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('Ctrl+C sans sélection ne colle rien et ne change rien', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await page.keyboard.press('Control+c');
    await selectionner(page, 0, 1);
    await page.keyboard.press('Control+v');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });
});
