// MODULE « grille » — ajout au clic : le « + » qui apparaît devant une case ouvre le panneau « Ajouter » (destination + accords proposés).
// Ordinateur seulement : au téléphone ce « + » n'existe pas (on passe par « + Accord », voir ajout-rapide.spec.ts).
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, noms, caseN, cases, cliquerPlusAvant, titres } from './aide-grille';

test.describe('Ajout au clic @grille @ordinateur', () => {
  test('un clic sur le « + » d\'une case ouvre le panneau avec la destination et les accords proposés @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await cliquerPlusAvant(page, 0, 1);
    const panneau = page.locator('#quick-add-panel');
    await expect(panneau).toContainText('Couplet, avant Am (après C)');
    await expect(panneau).toContainText('Souvent après C');
    await expect(panneau).toContainText('Accords de C majeur');
    await expect(page.locator('#quick-add-input')).toBeFocused();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);   // ouvrir ne change rien
    expect(garde.bloquees).toEqual([]);
  });

  test('un clic sur un accord proposé l\'insère à l\'endroit choisi, le panneau reste ouvert pour enchaîner @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await cliquerPlusAvant(page, 0, 1);
    const panneau = page.locator('#quick-add-panel');
    await panneau.getByRole('button', { name: /^Dm/ }).click();
    expect(await noms(page)).toEqual(['C', 'Dm', 'Am', 'F', 'G']);
    await expect(panneau).toContainText('avant Am (après Dm)');   // la destination avance avec l'insertion
    await panneau.getByRole('button', { name: /^Em/ }).click();
    expect(await noms(page)).toEqual(['C', 'Dm', 'Em', 'Am', 'F', 'G']);
  });

  test('« avec 7e » propose les accords à quatre sons et les insère', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await cliquerPlusAvant(page, 0, 3);   // avant G
    const panneau = page.locator('#quick-add-panel');
    await panneau.getByRole('button', { name: 'avec 7e' }).click();
    await expect(panneau).toContainText('Cmaj7');
    await panneau.getByRole('button', { name: /^Dm7/ }).last().click();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'Dm7', 'G']);
  });

  test('le « + » devant la première case insère en tête de partie', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await cliquerPlusAvant(page, 0, 0);
    await expect(page.locator('#quick-add-panel')).toContainText('Couplet, avant C');
    await page.locator('#quick-add-input').fill('Em');
    await page.locator('#quick-add-btn').click();
    expect(await noms(page)).toEqual(['Em', 'C', 'Am', 'F', 'G']);
  });

  test('l\'insertion dans la seconde partie ne touche pas la première', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await page.getByRole('button', { name: 'Ajouter une section' }).click();
    await expect(page.locator('#progression-sections .prog-section')).toHaveCount(2);
    const plus2 = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).nth(1);
    await plus2.fill('Dm//G'); await plus2.press('Enter');
    expect(await noms(page, 1)).toEqual(['Dm', 'G']);
    await cliquerPlusAvant(page, 1, 1);
    await page.locator('#quick-add-input').fill('Em');
    await page.locator('#quick-add-btn').click();
    expect(await noms(page, 1)).toEqual(['Dm', 'Em', 'G']);
    expect(await noms(page, 0)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('Échap, « Fermer » et un clic à côté ferment le panneau sans rien ajouter', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const saisie = page.locator('#quick-add-input');
    await cliquerPlusAvant(page, 0, 1);
    await expect(saisie).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(saisie).toBeHidden();
    await cliquerPlusAvant(page, 0, 1);
    await page.locator('#quick-add-panel').getByRole('button', { name: 'Fermer' }).click();
    await expect(saisie).toBeHidden();
    await cliquerPlusAvant(page, 0, 1);
    await page.mouse.click(100, 520);
    await expect(saisie).toBeHidden();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('la case « + » du bout de partie : un clic donne le focus au champ, Entrée valide un accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await page.locator('#progression-sections .grid-cell-add').first().click();
    const champ = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
    await expect(champ).toBeFocused();
    await page.keyboard.type('Em7');
    await page.keyboard.press('Enter');
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'Em7']);
  });

  // À ARBITRER (voir bugs.md) : le plan du module parle d'un « double-clic sur + ». Le panneau s'ouvre au premier clic, la grille descend
  // sous le pointeur, le second clic tombe « à côté » et referme tout : l'utilisateur qui double-clique voit le panneau clignoter puis disparaître.
  test('un double-clic sur le « + » laisse le panneau d\'ajout ouvert', async ({ ouvrirAppli }) => {
    test.fail(true, 'G-03 (bugs.md) : bug connu, le test doit repasser au vert quand il sera corrigé');
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const c = caseN(page, 0, 2);
    await c.hover();
    const plus = c.locator('.cell-ins');
    await expect(plus).toBeVisible();
    const b = (await plus.boundingBox())!;
    await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
    await expect(page.locator('#quick-add-input')).toBeVisible();
    await expect(page.locator('#quick-add-panel')).toContainText('avant F (après Am)');
  });
});
