// MODULE « sequenceur » — choisir et bouger les notes au clavier et au lasso (essai neutre du 20/11, ES-11, ES-12 et amélioration 6) :
// Ctrl+A choisit toutes les notes (et non tout le texte de la page), Maj + glisser dans le vide trace un lasso, les flèches déplacent les notes
// choisies d'une croche ou d'une ligne, Échap pendant un glisser remet la note en place.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import { C_AM_F_G, celluleNote, grille, ouvrirSurAccord, boutonEffacer, glisser } from './aide-sequenceur';

const choisies = (page: Page) => grille(page).locator('.sq-sel-g');
const allumee = (page: Page, note: string, croche: number) => celluleNote(page, 1, note, croche);

// Part d'un accord Am VIDÉ, avec une seule note posée en A3, croche 3 (un clic pose une croche), puis la choisit (un clic sur une note la choisit).
async function uneNote(page: Page) {
  await ouvrirSurAccord(page, 1);
  await boutonEffacer(page).click();
  await expect(grille(page).locator('.sq-case.on[data-c="1"]')).toHaveCount(0);
  await allumee(page, 'A3', 3).click();
  await expect(allumee(page, 'A3', 3)).toHaveAttribute('aria-label', /: normal$/);
  await allumee(page, 'A3', 3).click();
  await expect(choisies(page)).toHaveCount(1);
}

test.describe('Choisir et bouger les notes au clavier et au lasso @sequenceur @ordinateur', () => {
  test('Ctrl+A choisit toutes les notes du séquenceur, sans surligner le texte de la page (ES-12)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await allumee(page, 'A3', 1).click();
    await page.keyboard.press('Control+a');
    await expect(choisies(page)).toHaveCount(12);   // quatre accords de trois notes tenues
    expect(await page.evaluate(() => String(window.getSelection())).then(t => t.trim())).toBe('');
  });

  test('Maj + glisser dans le vide trace un lasso et choisit les notes qu\'il touche @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await boutonEffacer(page).click();
    await allumee(page, 'A3', 3).click();
    await allumee(page, 'C4', 5).click();
    await allumee(page, 'E4', 7).click();
    await expect(grille(page).locator('.sq-case.on[data-c="1"]')).toHaveCount(3);
    // du vide (ligne du haut, début de la mesure) jusqu'à la ligne du bas, croche 6 : touche A3 (croche 3) et C4 (croche 5), pas E4 (croche 7)
    const haut = (await allumee(page, 'E4', 1).boundingBox())!, bas = (await allumee(page, 'A3', 6).boundingBox())!;
    await page.keyboard.down('Shift');
    await glisser(page, { x: haut.x + 3, y: haut.y + 3 }, { x: bas.x + bas.width - 3, y: bas.y + bas.height - 3 }, 10);
    await page.keyboard.up('Shift');
    await expect(choisies(page)).toHaveCount(2);
    await expect(allumee(page, 'E4', 7)).not.toHaveClass(/sq-sel/);
  });

  test('→ déplace la note choisie d\'une croche, ← la ramène, sous une annulation', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await uneNote(page);
    await page.keyboard.press('ArrowRight');
    await expect(allumee(page, 'A3', 4)).toHaveAttribute('aria-label', /: normal$/);
    await expect(allumee(page, 'A3', 3)).toHaveAttribute('aria-label', /: vide$/);
    await page.keyboard.press('ArrowLeft');
    await expect(allumee(page, 'A3', 3)).toHaveAttribute('aria-label', /: normal$/);
    await page.keyboard.press('Control+z');
    await expect(allumee(page, 'A3', 4)).toHaveAttribute('aria-label', /: normal$/);
  });

  test('↑ monte la note choisie d\'une ligne', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await uneNote(page);
    await page.keyboard.press('ArrowUp');
    await expect(allumee(page, 'A3', 3)).toHaveAttribute('aria-label', /: vide$/);
    await expect(allumee(page, 'C4', 3)).toHaveAttribute('aria-label', /: normal$/);
  });

  test('un déplacement impossible (hors de la mesure) ne change rien et le dit', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await boutonEffacer(page).click();
    await allumee(page, 'A3', 1).click();
    await allumee(page, 'A3', 1).click();
    await expect(choisies(page)).toHaveCount(1);
    await page.keyboard.press('ArrowLeft');
    await expect(allumee(page, 'A3', 1)).toHaveAttribute('aria-label', /: normal$/);
    await expect(page.locator('#toast')).toContainText(/Déplacement impossible/);
  });

  test('Échap pendant un glisser remet la note à sa place (ES-11)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await uneNote(page);
    const d = (await allumee(page, 'A3', 3).boundingBox())!, v = (await allumee(page, 'C4', 6).boundingBox())!;
    await page.mouse.move(d.x + d.width / 2, d.y + d.height / 2);
    await page.mouse.down();
    await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2, { steps: 10 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(allumee(page, 'A3', 3)).toHaveAttribute('aria-label', /: normal$/);
    await expect(allumee(page, 'C4', 6)).toHaveAttribute('aria-label', /: vide$/);
  });
});
