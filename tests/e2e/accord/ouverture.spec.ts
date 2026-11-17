// MODULE « accord » — ouvrir et fermer la fenêtre d'accord (ordinateur : bulle flottante à côté de la case).
import { test, expect } from '../support/fixtures';
import { C_AM_F_G, caseN, ouvrirFenetre, fenetre, choisirOnglet } from './aide-accord';

test.describe('Fenêtre d\'accord — ouverture @accord @ordinateur', () => {
  test('un double-clic sur une case ouvre la fenêtre : nom, fonction, mesure, partie et trois onglets @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(fenetre(page)).toBeHidden();
    const f = await ouvrirFenetre(page, 0, 1);
    await expect(f).toHaveAccessibleName('Accord Am');
    await expect(f).toContainText('Am');
    await expect(f).toContainText('vi');          // fonction dans la tonalité de do
    await expect(f).toContainText('mes. 2');
    await expect(f.getByTitle('Couplet · accord 2 sur 4')).toBeVisible();
    const onglets = f.getByRole('group', { name: 'Accord, voicing ou rythme' });
    await expect(onglets.getByRole('button')).toHaveText(['Accord', 'Voicing', 'Rythme']);
    await expect(onglets.getByRole('button', { name: 'Accord', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(garde.bloquees).toEqual([]);
  });

  test('un simple clic sélectionne la case sans ouvrir la fenêtre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 1).click();
    await expect(caseN(page, 0, 1)).toHaveClass(/\bselected\b/);
    await expect(fenetre(page)).toBeHidden();
  });

  test('« Modifier » du menu du clic droit ouvre la fenêtre sur la case cliquée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 2).click({ button: 'right' });
    await page.locator('#context-menu').getByText('Modifier', { exact: true }).click();
    await expect(fenetre(page)).toBeVisible();
    await expect(fenetre(page)).toHaveAccessibleName('Accord F');
  });

  test('Échap, « Fermer » et un clic à côté ferment la fenêtre sans rien changer @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirFenetre(page, 0, 1);
    await page.keyboard.press('Escape');
    await expect(fenetre(page)).toBeHidden();
    await ouvrirFenetre(page, 0, 1);
    await fenetre(page).getByRole('button', { name: 'Fermer' }).click();
    await expect(fenetre(page)).toBeHidden();
    await ouvrirFenetre(page, 0, 1);
    await page.mouse.click(100, 300);
    await expect(fenetre(page)).toBeHidden();
    await expect(page.locator('#progression-sections .grid-cell[data-index] .cell-sym')).toHaveText(['C', 'Am', 'F', 'G']);
  });

  test('la fenêtre suit la case sur laquelle on clique ensuite', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirFenetre(page, 0, 0);
    await expect(fenetre(page)).toHaveAccessibleName('Accord C');
    await caseN(page, 0, 3).click();
    await expect(fenetre(page)).toHaveAccessibleName('Accord G');
    await expect(fenetre(page)).toContainText('mes. 4');
  });

  test('l\'onglet choisi est gardé quand on change d\'accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const f = await ouvrirFenetre(page, 0, 1);
    await choisirOnglet(f, 'Voicing');
    await f.getByRole('button', { name: 'Accord suivant' }).click();
    await expect(f).toHaveAccessibleName('Accord F');
    await expect(f.getByRole('button', { name: 'Voicing', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(f.getByRole('group', { name: 'Octave' })).toBeVisible();
  });

  test('la fenêtre reste entièrement dans l\'écran, même ouverte sur la dernière case d\'une partie chargée', async ({ ouvrirAppli }) => {
    const accords = Array.from({ length: 8 }, (_, i) => ({ root: 'CDEFGABC'[i], quality: i % 2 ? 'min' : '' }));
    const page = await ouvrirAppli({ accords });
    const f = await ouvrirFenetre(page, 0, 7);
    const b = (await f.boundingBox())!, vue = page.viewportSize()!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(vue.width);
    expect(b.y + b.height).toBeLessThanOrEqual(vue.height);
  });
});
