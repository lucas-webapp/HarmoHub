// MODULE « lecture » — la vitesse (50 à 200 % du tempo, pour travailler lentement un passage) et le métronome.
// Le son est factice : pour le métronome on COMPTE les clics demandés par l'appli (espion sur `playMetronomeClick`), on n'écoute rien.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, estMobile, ouvrirTempo, fermerTempo, plusRapide, curseurVitesse, boutonMetronome, boutonCroche, boutonLecture, tempo, enLecture,
  observerPassages, dureeMoyenneMesure, espionnerClics, nombreDeClics, attendreFinDeLecture, vitesseMax, valeurTempo,
} from './aide-lecture';

const valeurVitesse = (page: import('@playwright/test').Page) => page.locator('#bl-vitesse-val');
const bpmDeLecture = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).app.bpmLecture() as number);

test.describe('Vitesse de lecture @lecture', () => {
  test('la vitesse part à 100 % ; le curseur la règle de 50 à 200 % sans toucher au tempo @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    await expect(curseurVitesse(page)).toHaveValue('100');
    await expect(valeurVitesse(page)).toHaveText('100 %');
    expect(await bpmDeLecture(page)).toBe(120);
    await curseurVitesse(page).fill('150');
    await expect(valeurVitesse(page)).toHaveText('150 %');
    expect(await bpmDeLecture(page)).toBe(180);   // 120 BPM × 150 %
    expect(await tempo(page)).toBe(120);          // le tempo du morceau ne change pas
    await curseurVitesse(page).fill('50');
    await expect(valeurVitesse(page)).toHaveText('50 %');
    expect(await bpmDeLecture(page)).toBe(60);
    await curseurVitesse(page).fill('200');
    await expect(valeurVitesse(page)).toHaveText('200 %');
    expect(await bpmDeLecture(page)).toBe(240);
    await expect(valeurTempo(page)).toHaveText('120 BPM');
  });

  test('la vitesse se combine avec le tempo (tempo 121 × 50 % = 60,5 → 61 BPM de lecture)', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    await plusRapide(page).click();
    await curseurVitesse(page).fill('50');
    await expect(valeurVitesse(page)).toHaveText('50 %');
    expect(await tempo(page)).toBe(121);
    expect(await bpmDeLecture(page)).toBeGreaterThanOrEqual(60);
    expect(await bpmDeLecture(page)).toBeLessThanOrEqual(61);
  });

  test('hors des 100 %, le bouton de la barre le rappelle (« · 150 % ») et le retire à 100 % @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(page.locator('#bl-vitesse-tag')).toBeHidden();
    await ouvrirTempo(page);
    await curseurVitesse(page).fill('150');
    await fermerTempo(page);
    await expect(page.locator('#bl-vitesse-tag')).toBeVisible();
    await expect(page.locator('#bl-vitesse-tag')).toHaveText('· 150 %');
    await expect(page.locator('#bl-tempo')).toContainText('120');
    await ouvrirTempo(page);
    await curseurVitesse(page).fill('100');
    await fermerTempo(page);
    await expect(page.locator('#bl-vitesse-tag')).toBeHidden();
  });

  test('à 200 % une mesure dure environ une seconde, à 100 % environ deux (120 BPM) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await observerPassages(page);
    await boutonLecture(page).click();
    const vite = await dureeMoyenneMesure(page);
    expect(vite).toBeGreaterThan(700);   // ~1000 ms ; 1500 sépare nettement 200 % (1 s) de 100 % (2 s)
    expect(vite).toBeLessThan(1500);
    await page.locator('#stop').click();
    await expect.poll(() => enLecture(page)).toBe(false);

    await ouvrirTempo(page);
    await curseurVitesse(page).fill('100');
    await expect(valeurVitesse(page)).toHaveText('100 %');
    await fermerTempo(page);
    await observerPassages(page);
    await boutonLecture(page).click();
    const normal = await dureeMoyenneMesure(page);
    expect(normal).toBeGreaterThan(1600);
    expect(normal).toBeLessThan(2800);
    await page.locator('#stop').click();
  });

  test('le curseur s\'accroche aux repères 50, 75, 100, 150 et 200 % quand on en approche', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    for (const [pose, attendu] of [['95', '100 %'], ['105', '100 %'], ['70', '75 %'], ['155', '150 %'], ['110', '110 %'], ['60', '60 %']] as const) {
      await curseurVitesse(page).fill(pose);
      await expect(valeurVitesse(page)).toHaveText(attendu);
    }
  });

  test('au clavier, les flèches font quitter un repère (100 %) @ordinateur', async ({ ouvrirAppli }) => {
    // L-03 (bugs.md) : l'accroche aux repères rend la flèche droite sans effet à 100 % (et à 50, 75, 150 %) : 105 % retombe à 100 %.
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    await curseurVitesse(page).focus();
    await expect(curseurVitesse(page)).toHaveValue('100');
    await page.keyboard.press('ArrowRight');
    await expect(curseurVitesse(page)).not.toHaveValue('100', { timeout: 2_000 });
  });

  test('« Page haut » fait quitter un repère : le curseur reste utilisable au clavier @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    await curseurVitesse(page).focus();
    await page.keyboard.press('PageUp');
    await expect(valeurVitesse(page)).toHaveText('115 %');
    await page.keyboard.press('Home');
    await expect(valeurVitesse(page)).toHaveText('50 %');
    await page.keyboard.press('End');
    await expect(valeurVitesse(page)).toHaveText('200 %');
  });
});

test.describe('Métronome @lecture', () => {
  test('le bouton « Garder le métronome » s\'allume et s\'éteint, et le choix survit au rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    await expect(boutonMetronome(page)).toHaveAttribute('aria-pressed', 'false');
    if (estMobile(page)) await expect(boutonMetronome(page)).toContainText('Coupé');
    await boutonMetronome(page).click();
    await expect(boutonMetronome(page)).toHaveAttribute('aria-pressed', 'true');
    if (estMobile(page)) await expect(boutonMetronome(page)).toContainText('Activé');
    expect(await page.evaluate(() => (window as any).app.metronomeDuringPlayback)).toBe(true);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrirTempo(page);
    await expect(boutonMetronome(page)).toHaveAttribute('aria-pressed', 'true');
    await boutonMetronome(page).click();
    await expect(boutonMetronome(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => (window as any).app.metronomeDuringPlayback)).toBe(false);
  });

  test('métronome coupé : seul le décompte d\'une mesure sonne (4 clics) ; allumé : un clic par temps en plus @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });   // 4 mesures de 4 temps
    await vitesseMax(page);
    await espionnerClics(page);
    await boutonLecture(page).click();
    await attendreFinDeLecture(page);
    expect(await nombreDeClics(page)).toBe(4);   // décompte seul

    await ouvrirTempo(page);
    await boutonMetronome(page).click();
    await expect(boutonMetronome(page)).toHaveAttribute('aria-pressed', 'true');
    await fermerTempo(page);
    await espionnerClics(page);
    await boutonLecture(page).click();
    await attendreFinDeLecture(page);
    expect(await nombreDeClics(page)).toBe(4 + 16);   // décompte + 16 temps
  });

  test('le clic à la croche double les clics (contretemps) et se rappelle après rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await vitesseMax(page);
    await ouvrirTempo(page);
    await expect(boutonCroche(page)).toHaveAttribute('aria-pressed', 'false');
    await boutonCroche(page).click();
    await expect(boutonCroche(page)).toHaveAttribute('aria-pressed', 'true');
    await boutonMetronome(page).click();
    await fermerTempo(page);
    await espionnerClics(page);
    await boutonLecture(page).click();
    await attendreFinDeLecture(page);
    const croches = await nombreDeClics(page);
    expect(croches).toBeGreaterThanOrEqual(36);   // (décompte 4 + 16 temps) × 2, à un clic près selon la mesure de fin
    expect(croches).toBeLessThanOrEqual(42);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrirTempo(page);
    await expect(boutonCroche(page)).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Chevrons maintenus @lecture @ordinateur', () => {
  test('maintenir « Plus rapide » enfoncé fait défiler le tempo, comme l\'annonce son infobulle', async ({ ouvrirAppli }) => {
    // L-02 (bugs.md) : à la souris, maintenir le chevron ne fait que +1 (le défilement ne démarre pas).
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    await expect(plusRapide(page)).toHaveAttribute('title', /maintenir pour faire défiler/);
    await plusRapide(page).hover();
    await page.mouse.down();
    try { await expect.poll(() => tempo(page), { timeout: 3_000 }).toBeGreaterThan(125); }
    finally { await page.mouse.up(); }
  });
});
