// MODULE « voicing » — les échelles H (horizontale) et V (verticale) de la fenêtre « Conduite des voix » : un cran = ×1,25, bornes 0,7 et 2, mémorisées par
// appareil (stockage local, retrouvées après un rechargement), indépendantes l'une de l'autre, la fenêtre reste ouverte. Ordinateur et iPad.
import { test, expect } from '../support/fixtures';
import {
  COUPLET, reglagesMorceau, morceauQuatreParties, popover, dessin, notes, defilante, touches, ouvrirVoicing, activerPartie, taille, hauteurs, reglageEchelle, titre,
} from './aide-voicing';

const partie = () => reglagesMorceau([{ titre: 'Couplet', accords: COUPLET }]);
const plusH = (page: any) => popover(page).getByRole('button', { name: 'Agrandir l\'échelle horizontale' });
const moinsH = (page: any) => popover(page).getByRole('button', { name: 'Réduire l\'échelle horizontale' });
const plusV = (page: any) => popover(page).getByRole('button', { name: 'Agrandir l\'échelle verticale' });
const moinsV = (page: any) => popover(page).getByRole('button', { name: 'Réduire l\'échelle verticale' });
// La hauteur d'un cran vertical, mesurée sur le dessin (écart entre la note la plus grave et la plus aiguë du premier accord : 11 demi-tons).
const ecart = async (page: any) => { const y = await hauteurs(page); return y[0] - y[3]; };

test.describe('Échelles de la conduite des voix @voicing @ordinateur', () => {
  test('la fenêtre propose les échelles H et V, chacune avec un bouton « agrandir » et un bouton « réduire »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: partie() });
    await ouvrirVoicing(page);
    await expect(popover(page).getByTitle('Échelle horizontale', { exact: true })).toContainText('H');
    await expect(popover(page).getByTitle('Échelle verticale', { exact: true })).toContainText('V');
    for (const b of [plusH(page), moinsH(page), plusV(page), moinsV(page)]) await expect(b).toBeEnabled();
  });

  test('H + élargit le dessin de 25 % sans toucher à sa hauteur ; la fenêtre reste ouverte @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: partie() });
    await ouvrirVoicing(page);
    const avant = await taille(page);
    await plusH(page).click();
    await expect.poll(async () => (await taille(page)).largeur / avant.largeur).toBeCloseTo(1.25, 1);
    expect((await taille(page)).hauteur).toBe(avant.hauteur);
    await expect(popover(page)).toBeVisible();
    await expect(notes(page)).toHaveCount(16);
  });

  test('V + agrandit la hauteur d\'une ligne de 25 % sans toucher à la largeur ; les touches suivent @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: partie() });
    await ouvrirVoicing(page);
    const avant = await taille(page), e0 = await ecart(page);
    const touchesAvant = (await touches(page).boundingBox())!;
    await plusV(page).click();
    await expect.poll(async () => (await ecart(page)) / e0).toBeCloseTo(1.25, 1);
    expect((await taille(page)).largeur).toBe(avant.largeur);
    expect((await taille(page)).hauteur).toBeGreaterThan(avant.hauteur);
    // la colonne des touches grandit du même pas que le dessin : toujours alignée sur lui
    const t = (await touches(page).boundingBox())!, d = (await dessin(page).boundingBox())!;
    expect(t.height).toBeGreaterThan(touchesAvant.height);
    expect(t.height).toBeCloseTo(d.height, 0);
    await expect(popover(page)).toBeVisible();
  });

  test('H − et V − ramènent au dessin de départ', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: partie() });
    await ouvrirVoicing(page);
    const avant = await taille(page), e0 = await ecart(page);
    await plusH(page).click(); await plusV(page).click();
    await expect.poll(async () => (await taille(page)).largeur).toBeGreaterThan(avant.largeur);
    await moinsH(page).click(); await moinsV(page).click();
    await expect.poll(async () => await taille(page)).toEqual(avant);
    expect(await ecart(page)).toBe(e0);
  });

  test('H s\'arrête à ×2 en agrandissant et à ×0,7 en réduisant', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: partie() });
    await ouvrirVoicing(page);
    const L0 = (await taille(page)).largeur;
    for (let i = 0; i < 6; i++) await plusH(page).click();
    await expect.poll(async () => (await taille(page)).largeur / L0).toBeCloseTo(2, 1);
    await plusH(page).click();
    expect((await taille(page)).largeur / L0).toBeCloseTo(2, 1);             // un cran de plus ne change rien
    for (let i = 0; i < 12; i++) await moinsH(page).click();
    await expect.poll(async () => (await taille(page)).largeur / L0).toBeCloseTo(0.7, 1);
    await moinsH(page).click();
    expect((await taille(page)).largeur / L0).toBeCloseTo(0.7, 1);
  });

  test('V s\'arrête à ×2 en agrandissant et à ×0,7 en réduisant', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: partie() });
    await ouvrirVoicing(page);
    const e0 = await ecart(page);
    for (let i = 0; i < 6; i++) await plusV(page).click();
    await expect.poll(async () => (await ecart(page)) / e0).toBeCloseTo(2, 1);
    await plusV(page).click();
    expect((await ecart(page)) / e0).toBeCloseTo(2, 1);
    for (let i = 0; i < 12; i++) await moinsV(page).click();
    await expect.poll(async () => (await ecart(page)) / e0).toBeCloseTo(0.7, 1);
    await moinsV(page).click();
    expect((await ecart(page)) / e0).toBeCloseTo(0.7, 1);
  });

  test('chaque échelle est retenue par l\'appareil : retrouvée après un rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: partie() });
    await ouvrirVoicing(page);
    const L0 = (await taille(page)).largeur, e0 = await ecart(page);
    await plusH(page).click(); await plusH(page).click(); await plusV(page).click();
    await expect.poll(() => reglageEchelle(page)).toEqual(['1.563', '1.25']);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrirVoicing(page);
    await expect(notes(page)).toHaveCount(16);
    expect((await taille(page)).largeur / L0).toBeCloseTo(1.5625, 1);
    expect((await ecart(page)) / e0).toBeCloseTo(1.25, 1);
  });

  test('les échelles ne changent pas d\'une partie à l\'autre : elles sont celles de l\'appareil', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await ouvrirVoicing(page);
    await plusH(page).click();
    await expect.poll(() => reglageEchelle(page)).toEqual(['1.25', null]);
    const unAccord = (await taille(page)).largeur / 4;           // largeur d'une colonne du Couplet (4 accords)
    await page.keyboard.press('Escape');
    await activerPartie(page, 1);
    await ouvrirVoicing(page);
    await expect(titre(page)).toHaveText('Refrain');
    expect((await taille(page)).largeur / 3).toBeCloseTo(unAccord, 0);   // même largeur de colonne dans le Refrain (3 accords)
  });

  test('V + garde l\'endroit où l\'on est quand on a fait défiler une partie longue', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await activerPartie(page, 3);
    await ouvrirVoicing(page);
    // on fait défiler la partie (molette horizontale ; WebKit mobile n'a pas de molette dans Playwright : l'iPad la remplace par un défilement posé directement)
    await defilante(page).evaluate(e => { e.scrollLeft = 500; });
    await expect.poll(() => defilante(page).evaluate(e => e.scrollLeft)).toBeGreaterThan(100);
    const avant = await defilante(page).evaluate(e => e.scrollLeft);
    await plusV(page).click();
    await expect.poll(async () => (await ecart(page))).toBeGreaterThan(0);
    expect(await defilante(page).evaluate(e => e.scrollLeft)).toBeCloseTo(avant, 0);
  });

  test('avec un fort zoom vertical dans une fenêtre basse, la fenêtre reste dans l\'écran et son contenu défile', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 600 });
    await activerPartie(page, 3);
    await ouvrirVoicing(page);
    for (let i = 0; i < 4; i++) await plusV(page).click();
    const p = (await popover(page).boundingBox())!;
    expect(p.y + p.height).toBeLessThanOrEqual(600);                     // elle ne dépasse pas le bas de la fenêtre
    const haut = await popover(page).evaluate(e => ({ plein: e.scrollHeight, vu: e.clientHeight, regle: getComputedStyle(e).overflowY }));
    expect(haut.plein).toBeGreaterThan(haut.vu);                          // son contenu est plus grand que la fenêtre
    expect(haut.regle).toMatch(/auto|scroll/);                            // et elle défile
  });

  test('dans cette fenêtre basse, un coup de molette verticale fait défiler la fenêtre', async ({ ouvrirAppli, browserName, isMobile }) => {
    test.skip(isMobile && browserName === 'webkit', 'Playwright ne sait pas simuler la molette sur WebKit mobile (iPad) : mouse.wheel n\'y existe pas');
    const page = await ouvrirAppli({ reglages: morceauQuatreParties() });
    await page.setViewportSize({ width: page.viewportSize()!.width, height: 600 });
    await activerPartie(page, 3);
    await ouvrirVoicing(page);
    for (let i = 0; i < 4; i++) await plusV(page).click();
    await popover(page).hover();
    await page.mouse.wheel(0, 250);
    await expect.poll(() => popover(page).evaluate(e => e.scrollTop)).toBeGreaterThan(50);
  });

  test('régler une échelle ne modifie pas le morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: partie() });
    const avant = await page.evaluate(() => localStorage.getItem('myProgression'));
    await ouvrirVoicing(page);
    await plusH(page).click(); await plusV(page).click(); await moinsH(page).click();
    expect(await page.evaluate(() => localStorage.getItem('myProgression'))).toBe(avant);
  });
});
