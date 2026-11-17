// MODULE « lecture » — la boucle : tout le morceau (bouton) ou une plage tracée sur la règle des mesures (orange).
// Tracer la plage se fait à la souris sur la règle des mesures (ordinateur) ; le bouton de boucle sert aussi au téléphone.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, reglagesMorceau, boutonLecture, boutonStop, boutonBoucle, enLecture, caseEnLecture, vitesseMax, lireEtAttendre,
  suivreTete, suivreSequence, suivreSequenceCases, tracerPlage, plage, reglette, caseN,
} from './aide-lecture';

const barresDePlage = (page: import('@playwright/test').Page) => page.locator('#progression-sections .loop-range-bar');

test.describe('Boucle de lecture @lecture', () => {
  test('le bouton de boucle s\'active et se désactive ; son nom dit « tout le morceau » tant qu\'aucune plage n\'est tracée @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(boutonBoucle(page)).toHaveAccessibleName(/Boucler — tout le morceau/);
    await boutonBoucle(page).click();
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(boutonBoucle(page)).toHaveAccessibleName(/Boucle activée/);
    expect(await page.evaluate(() => (window as any).app.bouclerLecture)).toBe(true);
    await boutonBoucle(page).click();
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => (window as any).app.bouclerLecture)).toBe(false);
  });

  test('boucle sur tout le morceau : la tête revient à la première case au lieu de s\'arrêter @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await boutonBoucle(page).click();
    await lireEtAttendre(page);
    expect(await suivreSequence(page, 5)).toEqual([0, 1, 2, 3, 0]);   // 0 → 1 → 2 → 3 → de nouveau 0
    expect(await enLecture(page)).toBe(true);
    await boutonStop(page).click();
    await expect.poll(() => enLecture(page)).toBe(false);
    // (pas de vérification « plus aucune case allumée » ici : après un Stop donné à un instant quelconque, une case peut rester allumée, voir L-05)
  });

  test('tracer une plage sur la règle des mesures la colore et active la boucle @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    expect(await plage(page)).toBeNull();
    await expect(barresDePlage(page)).toHaveCount(0);
    await tracerPlage(page, 2, 3);
    await expect(barresDePlage(page)).toHaveCount(1);
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 2 });
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(boutonBoucle(page)).toHaveAccessibleName(/la plage tracée/);
    await expect(boutonLecture(page)).toHaveAttribute('title', /Lire la plage tracée en boucle/);
    // la barre orange couvre les mesures 2 et 3 de la règle, pas les autres
    const barre = (await barresDePlage(page).boundingBox())!;
    const m2 = (await reglette(page).nth(1).boundingBox())!, m3 = (await reglette(page).nth(2).boundingBox())!;
    const m1 = (await reglette(page).nth(0).boundingBox())!, m4 = (await reglette(page).nth(3).boundingBox())!;
    expect(barre.x).toBeLessThanOrEqual(m2.x + 6);
    expect(barre.x + barre.width).toBeGreaterThanOrEqual(m3.x + m3.width);
    expect(barre.x).toBeGreaterThan(m1.x + m1.width * 0.5);
    expect(barre.x + barre.width).toBeLessThan(m4.x + m4.width * 0.5);
  });

  test('lecture d\'une plage : seules les cases de la plage s\'allument, en boucle @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await tracerPlage(page, 2, 3);
    await lireEtAttendre(page);
    // on laisse passer deux tours et demi : seules les cases 1 et 2 s'allument, jamais 0 ni 3
    expect(await suivreSequence(page, 5)).toEqual([1, 2, 1, 2, 1]);
    await boutonStop(page).click();
  });

  test('boucle coupée : la plage reste dessinée, elle est lue une seule fois puis la lecture s\'arrête @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await tracerPlage(page, 2, 3);
    await boutonBoucle(page).click();
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(barresDePlage(page)).toHaveCount(1);
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 2 });
    await lireEtAttendre(page);
    const vus = await suivreTete(page, [1, 2]);
    expect(vus).toEqual([1, 2]);
    await expect.poll(() => enLecture(page), { timeout: 20_000 }).toBe(false);
    await expect(caseEnLecture(page)).toHaveCount(0);
  });

  test('on peut rallumer la boucle : la même plage est de nouveau lue @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await tracerPlage(page, 3, 4);
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 2, endSection: 0, endIndex: 3 });
    await boutonBoucle(page).click();
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'false');
    await boutonBoucle(page).click();
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 2, endSection: 0, endIndex: 3 });
  });

  test('le clic droit sur « Lecture » coupe et rallume la boucle @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await tracerPlage(page, 2, 3);
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'true');
    await boutonLecture(page).click({ button: 'right' });
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await enLecture(page)).toBe(false);   // un clic droit ne lance pas la lecture
    await boutonLecture(page).click({ button: 'right' });
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('glisser la poignée de droite agrandit la plage @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await tracerPlage(page, 2, 2);
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 1 });
    const poignee = page.locator('#progression-sections .loop-range-handle-right');
    const b = (await poignee.boundingBox())!;
    const quatrieme = (await caseN(page, 0, 3).boundingBox())!;   // la case de la mesure 4 : on lâche à son aplomb (voir L-01 pour la zone sensible de la règle)
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(quatrieme.x + quatrieme.width * 0.5, b.y + b.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 3 });
  });

  test('plage sur deux parties : la lecture passe de l\'une à l\'autre puis revient @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({
      reglages: reglagesMorceau([
        { titre: 'Couplet', accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] },
        { titre: 'Refrain', accords: [{ root: 'F', quality: '' }, { root: 'A', quality: 'min' }] },
      ]),
    });
    await vitesseMax(page);
    // plage = dernière mesure du Couplet (G) + première du Refrain (F) : tracée en deux appuis courts n'est pas possible d'une partie à l'autre
    // à la souris ; on trace donc dans une partie, et on vérifie qu'elle ne touche pas l'autre.
    await tracerPlage(page, 1, 2, 1);
    expect(await plage(page)).toEqual({ startSection: 1, startIndex: 0, endSection: 1, endIndex: 1 });
    await lireEtAttendre(page);
    expect(await suivreSequenceCases(page, 4)).toEqual(['1.0', '1.1', '1.0', '1.1']);
    await boutonStop(page).click();
  });

  test('ajouter un accord au milieu du morceau efface la plage (elle repose sur des numéros d\'accord) @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await tracerPlage(page, 2, 3);
    await expect(barresDePlage(page)).toHaveCount(1);
    // « + » devant « Am » (geste de l'utilisateur : survoler la case, cliquer son « + », saisir, valider)
    const c = page.locator('#progression-sections .grid-cell[data-section="0"][data-index="1"]');
    await c.hover();
    const plus = c.locator('.cell-ins');
    const b = (await plus.boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    const saisie = page.locator('#quick-add-input');
    await expect(saisie).toBeVisible();
    await saisie.fill('Dm');
    await saisie.press('Control+Enter');
    await expect(page.locator('#progression-sections .grid-cell[data-index] .cell-sym')).toHaveText(['C', 'Dm', 'Am', 'F', 'G']);
    await expect(barresDePlage(page)).toHaveCount(0);
    expect(await plage(page)).toBeNull();
  });
});

test.describe('Règle des mesures @lecture @ordinateur', () => {
  // L-01 (bugs.md) : la zone sensible de la règle est décalée vers la droite et ce décalage grandit d'une mesure à l'autre. Appuyer au CENTRE
  // du numéro « 3 » (ou « 4 ») puis glisser jusqu'au bout commence la plage une mesure trop tôt. Le numéro « 2 » est encore juste (contrôle).
  for (const [numero, fail] of [[2, false], [3, true], [4, true]] as const) {
    test(`appuyer sur le numéro « ${numero} » de la règle et glisser jusqu'au bout commence la plage à la mesure ${numero}`, async ({ ouvrirAppli }) => {
      test.fail(fail, 'L-01 (bugs.md) : la zone sensible de la règle des mesures est décalée vers la droite');
      const page = await ouvrirAppli({ accords: C_AM_F_G });
      const n = (await reglette(page).nth(numero - 1).boundingBox())!;
      const derniere = (await caseN(page, 0, 3).boundingBox())!;
      const y = n.y + n.height / 2;
      await page.mouse.move(n.x + n.width / 2, y);   // le centre du chiffre
      await page.mouse.down();
      await page.mouse.move(n.x + n.width / 2 + 20, y, { steps: 3 });
      await page.mouse.move(derniere.x + derniere.width * 0.5, y, { steps: 6 });
      await page.mouse.up();
      await expect.poll(() => plage(page)).toEqual({ startSection: 0, startIndex: numero - 1, endSection: 0, endIndex: 3 });
    });
  }
});

test.describe('Boucle de lecture au téléphone @lecture @mobile', () => {
  test('le bouton de boucle relance le morceau à son début au lieu de s\'arrêter @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await boutonBoucle(page).tap();
    await expect(boutonBoucle(page)).toHaveAttribute('aria-pressed', 'true');
    await lireEtAttendre(page);
    expect(await suivreSequence(page, 5)).toEqual([0, 1, 2, 3, 0]);
    await boutonStop(page).tap();
    await expect.poll(() => enLecture(page)).toBe(false);
  });
});
