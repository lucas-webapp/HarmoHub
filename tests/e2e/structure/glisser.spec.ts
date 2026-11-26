// MODULE « structure » — GLISSER-DÉPOSER d'une ligne par sa poignée (essai neutre du 25/11, SN-14). Les boutons ↑ ↓ restent pour le clavier ; le glisser est le geste
// « normal » d'un arrangeur : un trait montre où la ligne tombera, on lâche, UNE étape d'annulation.
import { test, expect } from '../support/fixtures';
import type { Page, Locator } from '@playwright/test';
import { morceauTroisParties, ouvrirStructure, lignes, titresLignes, repsLignes, plus, appuyer, structureStockee, structureDuMorceau, lire } from './aide-structure';

const poignee = (page: Page, n: number): Locator => lignes(page).nth(n).locator('.struct-poignee');
async function centre(l: Locator) { const b = (await l.boundingBox())!; return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }; }

// Attrape la poignée de la ligne `de`, la mène vers `y` (au milieu d'une ligne ou en dessous), et rend la main au test avant de lâcher.
async function attraper(page: Page, de: number, versY: (rect: { y: number; height: number }[]) => number) {
  const h = await centre(poignee(page, de));
  const boites: { y: number; height: number }[] = [];
  for (const r of await lignes(page).all()) boites.push((await r.boundingBox())!);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await page.mouse.move(h.x, h.y + 4, { steps: 2 });
  await page.mouse.move(h.x, versY(boites), { steps: 8 });
}

test.describe('Glisser une ligne de la structure @structure', () => {
  test('glisser le Couplet tout en bas : il passe en dernier, la grille ne bouge pas @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await attraper(page, 0, (b) => b[2].y + b[2].height - 2);
    await expect(lignes(page).nth(2)).toHaveClass(/struct-insere-fin/);          // le trait annonce où elle tombera
    await expect(lignes(page).nth(0)).toHaveClass(/struct-row-glisse/);
    await page.mouse.up();
    expect(await titresLignes(page)).toEqual(['Refrain', 'Pont', 'Couplet']);
    await expect(lignes(page).nth(0)).not.toHaveClass(/struct-row-glisse/);
    expect((await structureDuMorceau(page)).map(o => o.sid)).toEqual((await structureStockee(page)).map(o => o.sid));
    expect((await lire(page)).deroule).toBe('Refrain · Pont · Couplet');
  });

  test('glisser le Pont entre le Couplet et le Refrain : il garde son ×N et son nom', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 2));                                           // Pont ×2
    await attraper(page, 2, (b) => b[1].y + 2);                                   // sur la moitié haute du Refrain : « avant le Refrain »
    await expect(lignes(page).nth(1)).toHaveClass(/struct-insere-avant/);
    await page.mouse.up();
    expect(await titresLignes(page)).toEqual(['Couplet', 'Pont', 'Refrain']);
    expect(await repsLignes(page)).toEqual(['', '×2', '']);
  });

  test('glisser vers le haut : la première ligne devient la seconde', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await attraper(page, 1, (b) => b[0].y + 2);
    await page.mouse.up();
    expect(await titresLignes(page)).toEqual(['Refrain', 'Couplet', 'Pont']);
  });

  test('Échap en plein glissé : rien ne change, aucune étape d\'annulation, la fenêtre reste ouverte @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await attraper(page, 0, (b) => b[2].y + b[2].height - 2);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    await expect(page.getByRole('dialog', { name: 'Structure du morceau' })).toBeVisible();
    await expect(page.locator('#global-undo-btn')).toBeDisabled();
    await expect(lignes(page).nth(0)).not.toHaveClass(/struct-row-glisse/);
  });

  test('lâcher là où la ligne était : rien ne change, aucune étape d\'annulation', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await attraper(page, 1, (b) => b[1].y + b[1].height / 2);
    await expect(page.locator('#structure-panel .struct-insere-avant, #structure-panel .struct-insere-fin')).toHaveCount(0);   // pas de trait là où elle retomberait
    await page.mouse.up();
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    await expect(page.locator('#global-undo-btn')).toBeDisabled();
  });

  test('un glissé = une étape d\'annulation : Ctrl+Z remet l\'ordre, Ctrl+Y le rejoue', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await attraper(page, 0, (b) => b[2].y + b[2].height - 2);
    await page.mouse.up();
    expect(await titresLignes(page)).toEqual(['Refrain', 'Pont', 'Couplet']);
    await page.keyboard.press('Control+z');
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    await page.keyboard.press('Control+y');
    expect(await titresLignes(page)).toEqual(['Refrain', 'Pont', 'Couplet']);
  });

  test('chaque ligne a sa poignée (même une ligne « partie supprimée ») ; ↑ ↓ restent là pour le clavier', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await expect(page.locator('#structure-panel .struct-poignee')).toHaveCount(3);
    await expect(lignes(page).nth(1).getByRole('button', { name: /^Monter/ })).toBeEnabled();
  });
});
