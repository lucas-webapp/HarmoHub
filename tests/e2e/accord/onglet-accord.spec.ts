// MODULE « accord » — onglet « Accord » : fondamentale, type (qualité), basse, durée. Ordinateur.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, caseN, noms, ouvrirFenetre, fondamentale, basse, attendreAccord } from './aide-accord';

test.describe('Onglet Accord @accord @ordinateur', () => {
  test('la fondamentale et le type affichés sont ceux de l\'accord ouvert', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await expect(fondamentale(f, 'A')).toHaveAttribute('aria-pressed', 'true');
    await expect(f.locator('[data-bulle="root"][aria-pressed="true"]')).toHaveCount(1);
    await expect(f.getByRole('button', { name: 'Mineur' })).toHaveAttribute('aria-pressed', 'true');
    await expect(f.locator('[data-bulle="quality"][aria-pressed="true"]')).toHaveCount(1);
    await expect(basse(f, '')).toHaveAttribute('aria-pressed', 'true');   // « — » : basse = fondamentale
    await expect(f.getByLabel('Un temps de moins')).toBeEnabled();
    await expect(f.getByText('1 mesure', { exact: true })).toBeVisible();
  });

  test('changer la fondamentale renomme l\'accord dans la grille, sans toucher aux autres @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await fondamentale(f, 'D').click();
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('Dm');
    await expect(fondamentale(f, 'D')).toHaveAttribute('aria-pressed', 'true');
    await expect(fondamentale(f, 'A')).toHaveAttribute('aria-pressed', 'false');
    await expect(f).toHaveAccessibleName('Accord Dm');
    expect(await noms(page)).toEqual(['C', 'Dm', 'F', 'G']);
    await attendreAccord(page, 0, 1, { root: 'D', quality: 'min' });
  });

  test('changer le type garde la fondamentale : Majeur, Dom 7, Min 7, Maj 7 @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    const sym = caseN(page, 0, 1).locator('.cell-sym');
    for (const [bouton, nom, qualite] of [['Majeur', 'A', 'maj'], ['Dom 7', 'A7', 'dom7'], ['Min 7', 'Am7', 'min7'], ['Maj 7', 'Amaj7', 'maj7']] as const) {
      await f.getByRole('button', { name: bouton, exact: true }).click();
      await expect(sym).toHaveText(nom);
      await expect(f.getByRole('button', { name: bouton, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await attendreAccord(page, 0, 1, { root: 'A', quality: qualite });
    }
  });

  test('les 23 types sont proposés et chacun produit le bon symbole', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '' }] });
    const f = await ouvrirFenetre(page, 0, 0);
    await expect(f.locator('[data-bulle="quality"]')).toHaveCount(23);
    const attendus: [string, string][] = [
      ['Majeur', 'C'], ['Mineur', 'Cm'], ['Sus2', 'Csus2'], ['Sus4', 'Csus4'], ['Maj 7', 'Cmaj7'], ['Min 7', 'Cm7'], ['Dom 7', 'C7'], ['6', 'C6'],
      ['Min 6', 'Cm6'], ['Dim', 'Cdim'], ['Dim 7', 'Cdim7'], ['m7b5', 'Cm7b5'], ['Aug', 'Caug'], ['Add9', 'Cadd9'], ['Add11', 'Cadd11'],
      ['mAdd9', 'Cmadd9'], ['mAdd11', 'Cmadd11'], ['m Maj 7', 'Cmmaj7'],   // ajoutés le 20/11 : le séquenceur les reconnaît (Am + B, Am + D, Am + G♯)
      ['Maj 9', 'Cmaj9'], ['Min 9', 'Cm9'], ['9', 'C9'], ['11', 'C11'], ['13', 'C13'],
    ];
    for (const [bouton, symbole] of attendus) {
      await f.getByRole('button', { name: bouton, exact: true }).click();
      await expect(caseN(page, 0, 0).locator('.cell-sym'), `type « ${bouton} »`).toHaveText(symbole);
    }
  });

  test('les douze fondamentales sont proposées ; les altérées suivent l\'écriture de la tonalité', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '' }] });
    const f = await ouvrirFenetre(page, 0, 0);
    await expect(f.locator('[data-bulle="root"]')).toHaveText(['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']);
    await fondamentale(f, 'G').click();
    await expect(caseN(page, 0, 0).locator('.cell-sym')).toHaveText('G');
    await fondamentale(f, 'A#').click();
    await attendreAccord(page, 0, 0, { root: 'A#' });
    await expect(caseN(page, 0, 0).locator('.cell-sym')).toHaveText('B♭');   // en do, la case écrit B♭ (le bouton, lui, dit A♯)
  });

  test('la basse ajoute « /note » au nom ; « — » la retire', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 0);
    await basse(f, 'G').click();
    await expect(caseN(page, 0, 0).locator('.cell-sym')).toHaveText('C/G');
    await expect(basse(f, 'G')).toHaveAttribute('aria-pressed', 'true');
    await expect(basse(f, '')).toHaveAttribute('aria-pressed', 'false');
    await attendreAccord(page, 0, 0, { bass: 'G' });
    await basse(f, '').click();
    await expect(caseN(page, 0, 0).locator('.cell-sym')).toHaveText('C');
    await attendreAccord(page, 0, 0, { bass: null });
  });

  test('la durée se règle au temps près et la case change de largeur @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    const plus = f.getByRole('button', { name: 'Un temps de plus' }), moins = f.getByRole('button', { name: 'Un temps de moins' });
    const largeur = async () => (await caseN(page, 0, 1).boundingBox())!.width;
    const l4 = await largeur();
    await plus.click();
    await expect(f.getByText('1 mesure et 1 temps')).toBeVisible();
    await attendreAccord(page, 0, 1, { beats: 5 });
    expect(await largeur()).toBeGreaterThan(l4);
    await plus.click();
    await expect(f.getByText('1 mesure et 2 temps')).toBeVisible();
    await moins.click(); await moins.click();
    await expect(f.getByText('1 mesure', { exact: true })).toBeVisible();
    await expect.poll(largeur).toBeCloseTo(l4, 0);
    for (let i = 0; i < 3; i++) await moins.click();
    await expect(f.getByText('1 temps', { exact: true })).toBeVisible();
    await attendreAccord(page, 0, 1, { beats: 1 });
    await expect(moins).toBeDisabled();           // pas de durée nulle
    expect(await largeur()).toBeLessThan(l4);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('une durée de plusieurs mesures s\'écrit en toutes lettres', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '', beats: 8 }, { root: 'G', quality: '', beats: 6 }] });
    const f = await ouvrirFenetre(page, 0, 0);
    await expect(f.getByText('2 mesures', { exact: true })).toBeVisible();
    await f.getByRole('button', { name: 'Accord suivant' }).click();
    await expect(f.getByText('1 mesure et 2 temps')).toBeVisible();
  });

  // À ARBITRER (A-02, bugs.md) : une basse égale à la fondamentale s'écrit « A7/A ».
  test('une basse égale à la fondamentale n\'ajoute pas « /A » au nom', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await basse(f, 'A').click();
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('Am');
  });

  test('l\'en-tête de la fenêtre suit la fonction de l\'accord dans la tonalité', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await expect(f).toContainText('vi');
    await fondamentale(f, 'D').click();
    await expect(f).toContainText('ii');
    await expect(f).toHaveAccessibleName('Accord Dm');
  });
});
