// MODULE « sequenceur » — la poignée du haut du séquenceur (ordinateur) : tirer vers le haut montre plus de lignes, vers le bas moins ; tirée tout en haut,
// elle donne le PLEIN ÉCRAN (le séquenceur prend la place de la grille d'accords, la barre d'outils et la barre de lecture restent). Double-clic :
// retour à la hauteur de départ. Ni la hauteur ni le plein écran ne sont retenus d'une session à l'autre. Pas de poignée au téléphone.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  C_AM_F_G, ouvrirSurAccord, poignee, sequenceur, grille, glisser, vuePiano, bouton, celluleNote, nombreAllume, boutonEffacer, notesAllumees, ouvrirSequenceur,
} from './aide-sequenceur';
import { repondreAuxConfirmations } from '../grille/aide-grille';

const body = (page: Page) => page.locator('body');
const hauteur = async (page: Page) => (await sequenceur(page).boundingBox())!.height;
const hauteurGrilleAccords = async (page: Page) => (await page.locator('#progression-sections').boundingBox())?.height ?? 0;

// Tire la poignée de `dy` pixels (négatif = vers le haut) ou jusqu'à `yFinal`, comme à la souris : appuyer, bouger, relâcher.
async function tirer(page: Page, cible: { dy?: number; yFinal?: number }) {
  const b = (await poignee(page).boundingBox())!;
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await glisser(page, { x, y }, { x, y: cible.yFinal ?? y + cible.dy! });
}

test.describe('Poignée et plein écran — ordinateur @sequenceur @ordinateur', () => {
  test('la poignée est un séparateur horizontal nommé, au bord haut du séquenceur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    const p = page.getByRole('separator', { name: 'Nombre de lignes visibles du séquenceur' });
    await expect(p).toBeVisible();
    await expect(p).toHaveAttribute('aria-orientation', 'horizontal');
    const bp = (await p.boundingBox())!, bs = (await sequenceur(page).boundingBox())!;
    expect(Math.abs(bp.y - bs.y), 'la poignée est collée au bord haut du séquenceur').toBeLessThan(15);
    expect(bp.width).toBeGreaterThan(500);
  });

  test('tirer la poignée vers le haut montre plus de lignes, vers le bas moins (vue Piano) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await vuePiano(page).click();
    const depart = await hauteur(page);
    const grilleDepart = (await grille(page).boundingBox())!.height;
    await tirer(page, { dy: -100 });
    await expect.poll(() => hauteur(page)).toBeGreaterThan(depart + 50);
    expect((await grille(page).boundingBox())!.height).toBeGreaterThan(grilleDepart + 50);
    await expect(body(page)).not.toHaveClass(/sequenceur-plein/);
    await tirer(page, { dy: 250 });   // beaucoup plus bas que le départ
    await expect.poll(() => hauteur(page)).toBeLessThan(depart - 50);
    expect((await grille(page).boundingBox())!.height).toBeLessThan(grilleDepart - 50);
  });

  test('tirée tout en haut, la poignée donne le plein écran : la grille d\'accords disparaît, les barres restent @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await vuePiano(page).click();
    expect(await hauteurGrilleAccords(page)).toBeGreaterThan(50);
    await tirer(page, { yFinal: 40 });
    await expect(body(page)).toHaveClass(/sequenceur-plein/);
    expect(await hauteurGrilleAccords(page)).toBe(0);
    const s = (await sequenceur(page).boundingBox())!, vue = page.viewportSize()!;
    expect(s.height, 'le séquenceur occupe presque tout l\'écran').toBeGreaterThan(vue.height * 0.7);
    // la barre d'outils du séquenceur et la barre de lecture restent à l'écran
    await expect(bouton(page, 'Fermer le séquenceur')).toBeInViewport();
    await expect(page.getByRole('toolbar', { name: 'Lecture' })).toBeInViewport();
    await expect(poignee(page)).toBeVisible();
    expect(garde.bloquees).toEqual([]);
  });

  test('du plein écran, tirer la poignée vers le bas redonne la grille d\'accords', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await vuePiano(page).click();
    await tirer(page, { yFinal: 40 });
    await expect(body(page)).toHaveClass(/sequenceur-plein/);
    await tirer(page, { dy: 300 });
    await expect(body(page)).not.toHaveClass(/sequenceur-plein/);
    await expect.poll(() => hauteurGrilleAccords(page)).toBeGreaterThan(50);
  });

  test('un double-clic sur la poignée rend la hauteur de départ', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await vuePiano(page).click();
    const depart = await hauteur(page);
    await tirer(page, { dy: 200 });
    await expect.poll(() => hauteur(page)).toBeLessThan(depart - 50);
    await poignee(page).dblclick();
    await expect.poll(() => hauteur(page)).toBeCloseTo(depart, -1);
  });

  test('on peut éditer en plein écran, et fermer le séquenceur en sort', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await boutonEffacer(page).click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(0);
    await vuePiano(page).click();
    await tirer(page, { yFinal: 40 });
    await expect(body(page)).toHaveClass(/sequenceur-plein/);
    await celluleNote(page, 1, 'C4', 4).click();
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['1.3:normal']);
    await bouton(page, 'Fermer le séquenceur').click();
    await expect(sequenceur(page)).toBeHidden();
    await expect(body(page)).not.toHaveClass(/sequenceur-plein/);
    await expect.poll(() => hauteurGrilleAccords(page)).toBeGreaterThan(50);
  });

  test('le plein écran n\'est pas retenu après un rechargement : le séquenceur revient à sa hauteur de départ', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    repondreAuxConfirmations(page);
    await ouvrirSurAccord(page, 1);
    await vuePiano(page).click();
    const depart = await hauteur(page);
    await tirer(page, { yFinal: 40 });
    await expect(body(page)).toHaveClass(/sequenceur-plein/);
    await page.reload();
    await expect(sequenceur(page)).toBeVisible();
    await expect(body(page)).not.toHaveClass(/sequenceur-plein/);
    await expect.poll(() => hauteur(page)).toBeCloseTo(depart, -1);
    expect(await hauteurGrilleAccords(page)).toBeGreaterThan(50);
  });

  test('en vue Accord, la poignée ne masque jamais la grille d\'accords (pas de plein écran)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    const avant = await hauteurGrilleAccords(page);
    await tirer(page, { yFinal: 40 });
    await expect(body(page)).not.toHaveClass(/sequenceur-plein/);
    expect(await hauteurGrilleAccords(page)).toBeGreaterThan(50);
    expect(avant).toBeGreaterThan(50);
    await expect(sequenceur(page)).toBeVisible();
  });
});

test.describe('Poignée — téléphone @sequenceur @mobile', () => {
  test('le séquenceur du téléphone n\'a ni poignée visible ni plein écran', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    await expect(poignee(page)).toBeHidden();
    await expect(body(page)).not.toHaveClass(/sequenceur-plein/);
  });
});
