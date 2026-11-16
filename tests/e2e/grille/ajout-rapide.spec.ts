// MODULE « grille » — ajout rapide : saisie de plusieurs accords (« // »), accord sur basse (« / » et « _ »), nouvelle partie par ligne vide,
// saisie refusée. Ordinateur : la case « + » en bout de partie et le champ « Ajout rapide » ouvert par un « + » entre deux cases.
// Téléphone : le bouton « + Accord » de l'en-tête de partie ouvre le même champ.
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, noms, titres, cases, cliquerPlusAvant, saisirAjoutRapide, estMobile } from './aide-grille';

const champPlusFin = (page: import('@playwright/test').Page) => page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();

test.describe('Ajout rapide — ordinateur @grille @ordinateur', () => {
  test('« C//Am//F//G » dans la case « + » de fin de partie ajoute quatre accords dans l\'ordre @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli();
    await expect(cases(page)).toHaveCount(0);
    const plus = champPlusFin(page);
    await plus.fill('C//Am//F//G');
    await plus.press('Enter');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(plus).toHaveValue('');   // le champ est prêt pour la saisie suivante
    expect(garde.bloquees).toEqual([]);
  });

  test('les accords tapés un par un dans la case « + » s\'ajoutent à la suite, avec leur qualité @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    const plus = champPlusFin(page);
    for (const a of ['Cmaj7', 'Dm7', 'G7', 'Bdim']) { await plus.fill(a); await plus.press('Enter'); }
    expect(await noms(page)).toEqual(['Cmaj7', 'Dm7', 'G7', 'Bdim']);
  });

  test('un accord sur basse (« Bbadd9/C », « C_E ») s\'affiche avec sa basse', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    const plus = champPlusFin(page);
    await plus.fill('Bbadd9/C'); await plus.press('Enter');
    await plus.fill('C_E'); await plus.press('Enter');
    expect(await noms(page)).toEqual(['B♭add9/C', 'C/E']);
  });

  test('le panneau « Ajout rapide » ouvert par un « + » insère « C//Am//F//G » à l\'endroit choisi @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'D', quality: '' }, { root: 'E', quality: 'min' }] });
    await cliquerPlusAvant(page, 0, 1);   // avant Em
    await expect(page.locator('#quick-add-panel')).toContainText('avant Em (après D)');
    await saisirAjoutRapide(page, 'C//Am//F//G');
    expect(await noms(page)).toEqual(['D', 'C', 'Am', 'F', 'G', 'Em']);
    await expect(page.locator('#quick-add-input')).toHaveValue('');
  });

  test('« Bbadd9/C », « C_E » et « Dm7//G7 » sont compris par le panneau d\'ajout rapide', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] });
    await cliquerPlusAvant(page, 0, 1);
    await saisirAjoutRapide(page, 'Bbadd9/C');
    await saisirAjoutRapide(page, 'C_E');
    await saisirAjoutRapide(page, 'Dm7//G7');
    expect(await noms(page)).toEqual(['C', 'B♭add9/C', 'C/E', 'Dm7', 'G7', 'G']);
  });

  test('une ligne vide dans la saisie crée une nouvelle partie', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await cliquerPlusAvant(page, 0, 3);
    await saisirAjoutRapide(page, 'Dm\n\nEm');
    expect((await titres(page)).length).toBe(3);   // « Couplet » + deux nouvelles parties
    expect(await noms(page, 0)).toEqual(['C', 'Am', 'F', 'G']);   // la première partie n'a pas bougé
    expect(await noms(page)).toEqual(expect.arrayContaining(['Dm', 'Em']));
  });

  test('une saisie qui n\'est pas un accord ne change pas la grille et reste dans le champ', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await cliquerPlusAvant(page, 0, 1);
    await saisirAjoutRapide(page, 'xyz');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(page.locator('#quick-add-input')).toHaveValue('xyz');
    // même refus dans la case « + » de fin de partie
    const plus = champPlusFin(page);
    await plus.fill('xyz'); await plus.press('Enter');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  // Observation (voir bugs.md) : la saisie avec des ESPACES (« C Am F G ») n'est pas comprise : rien n'est ajouté et aucun message n'explique
  // pourquoi. Le test fige ce comportement observé (aide : « C//Am//F//G » ; séparateur « // ») sans le valider comme voulu.
  test('« C Am F G » (séparés par des espaces) n\'ajoute rien : la grille reste intacte', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'D', quality: '' }] });
    const plus = champPlusFin(page);
    await plus.fill('C Am F G'); await plus.press('Enter');
    expect(await noms(page)).toEqual(['D']);
    await cliquerPlusAvant(page, 0, 0);
    await saisirAjoutRapide(page, 'C Am F G');
    expect(await noms(page)).toEqual(['D']);
  });

  test('l\'aide « Comment utiliser l\'ajout rapide » liste « // » et « / »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await cliquerPlusAvant(page, 0, 1);
    await page.getByRole('button', { name: 'Comment utiliser l\'ajout rapide' }).click();
    const aide = page.locator('#quick-add-help');
    await expect(aide).toBeVisible();
    await expect(aide).toContainText('C//Am//F//G');
    await expect(aide).toContainText('Bbadd9/C');
  });

  test('l\'ajout est annulable puis rétablissable (Ctrl+Z, Ctrl+Maj+Z)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await cliquerPlusAvant(page, 0, 1);
    await saisirAjoutRapide(page, 'Dm//Em');
    expect(await noms(page)).toEqual(['C', 'Dm', 'Em', 'Am', 'F', 'G']);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+z');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await page.keyboard.press('Control+Shift+z');
    expect(await noms(page)).toEqual(['C', 'Dm', 'Em', 'Am', 'F', 'G']);
  });
});

test.describe('Ajout rapide — téléphone @grille @mobile', () => {
  test('« + Accord » ouvre le champ ; « C//Am//F//G » ajoute quatre accords @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli();
    expect(estMobile(page)).toBe(true);
    await page.locator('.prog-section-ajout').first().tap();
    const saisie = page.locator('#quick-add-input');
    await expect(saisie).toBeVisible();
    await saisie.fill('C//Am//F//G');
    await page.locator('#quick-add-btn').tap();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    await expect(saisie).toHaveValue('');
    expect(garde.bloquees).toEqual([]);
  });

  test('« Bbadd9/C » au téléphone s\'affiche avec sa basse, et « xyz » est refusé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await page.locator('.prog-section-ajout').first().tap();
    const saisie = page.locator('#quick-add-input');
    await saisie.fill('xyz');
    await page.locator('#quick-add-btn').tap();
    expect(await noms(page)).toEqual([]);
    await saisie.fill('Bbadd9/C');
    await page.locator('#quick-add-btn').tap();
    expect(await noms(page)).toEqual(['B♭add9/C']);
  });

  test('les accords ajoutés au téléphone sont conservés après rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await page.locator('.prog-section-ajout').first().tap();
    await page.locator('#quick-add-input').fill('Dm7//G7//Cmaj7');
    await page.locator('#quick-add-btn').tap();
    expect(await noms(page)).toEqual(['Dm7', 'G7', 'Cmaj7']);
    await page.reload();
    await expect(cases(page)).toHaveCount(3);
    expect(await noms(page)).toEqual(['Dm7', 'G7', 'Cmaj7']);
  });
});
