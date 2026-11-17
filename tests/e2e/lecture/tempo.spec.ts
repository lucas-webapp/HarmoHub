// MODULE « lecture » — le tempo : bouton « 120 BPM » de la barre (ordinateur) ou panneau « Lecture » (téléphone), chevrons, molette, glisser, TAP.
// Le tempo va de 60 à 240 BPM. Il est enregistré avec le morceau (bouton Enregistrer), pas à part.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, estMobile, ouvrirTempo, fermerTempo, fenetreTempo, valeurTempo, plusLent, plusRapide, boutonTap, tempo, boutonLecture, boutonStop,
  enLecture, indiceEnLecture, caseEnLecture, observerPassages, dureeMoyenneMesure,
} from './aide-lecture';

// Le centre de la valeur « 120 BPM » de la fenêtre : on y pose la souris pour la molette et le glisser.
async function surLaValeur(page: import('@playwright/test').Page) {
  await ouvrirTempo(page);
  const b = (await valeurTempo(page).boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  return b;
}

// Pousse le tempo vers une butée en glissant la valeur par grands coups (la souris existe aussi sur l'iPad ; la molette, non : WebKit mobile ne la gère pas).
async function glisserJusquauBout(page: import('@playwright/test').Page, sens: 'haut' | 'bas', butee: number) {
  const vue = page.viewportSize()!;
  for (let essai = 0; essai < 12 && (await tempo(page)) !== butee; essai++) {
    const b = (await valeurTempo(page).boundingBox())!;
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    const dy = sens === 'haut' ? -Math.min(300, y - 10) : Math.min(300, vue.height - y - 5);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + dy / 2, { steps: 5 });
    await page.mouse.move(x, y + dy, { steps: 5 });
    await page.mouse.up();
  }
  await expect(valeurTempo(page)).toHaveText(`${butee} BPM`);
}

test.describe('Tempo @lecture', () => {
  test('le bouton « 120 BPM » ouvre la fenêtre du tempo ; Échap puis un clic à côté la referment @critique @ordinateur', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(page.locator('#bl-tempo')).toHaveAccessibleName('120 BPM');
    await expect(page.locator('#bl-tempo-val')).toHaveText('120');
    await expect(fenetreTempo(page)).toBeHidden();
    await page.locator('#bl-tempo').click();
    await expect(fenetreTempo(page)).toBeVisible();
    await expect(valeurTempo(page)).toHaveText('120 BPM');
    await expect(fenetreTempo(page).getByRole('group', { name: 'Tempo' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(fenetreTempo(page)).toBeHidden();
    await page.locator('#bl-tempo').click();
    await expect(fenetreTempo(page)).toBeVisible();
    await page.mouse.click(300, 400);   // un endroit vide de la page
    await expect(fenetreTempo(page)).toBeHidden();
    expect(garde.bloquees).toEqual([]);
  });

  test('les chevrons règlent le tempo d\'un battement et la barre suit @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    expect(await tempo(page)).toBe(120);
    await plusRapide(page).click();
    await plusRapide(page).click();
    await plusRapide(page).click();
    await expect(valeurTempo(page)).toHaveText('123 BPM');
    expect(await tempo(page)).toBe(123);
    await plusLent(page).click();
    await expect(valeurTempo(page)).toHaveText('122 BPM');
    expect(await tempo(page)).toBe(122);
    if (estMobile(page)) {
      // au téléphone, le tempo est rappelé dans le bouton « Réglages du morceau »
      await expect(page.getByRole('button', { name: /^Réglages du morceau : .*122 BPM/ })).toBeVisible();
    } else {
      await fermerTempo(page);
      await expect(page.locator('#bl-tempo-val')).toHaveText('122');
      await expect(page.locator('#bl-tempo')).toHaveAccessibleName('122 BPM');
    }
  });

  test('la molette règle le tempo de 1 en 1, avec Maj de 5 en 5 @ordinateur', async ({ ouvrirAppli, browserName, isMobile }) => {
    test.skip(isMobile && browserName === 'webkit', 'Playwright ne sait pas simuler la molette sur WebKit mobile (iPad) : mouse.wheel n\'y existe pas');
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await surLaValeur(page);
    await page.mouse.wheel(0, -100);   // vers le haut = plus rapide
    await expect(valeurTempo(page)).toHaveText('121 BPM');
    await page.mouse.wheel(0, 100);
    await page.mouse.wheel(0, 100);
    await expect(valeurTempo(page)).toHaveText('119 BPM');
    await page.keyboard.down('Shift');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Shift');
    await expect(valeurTempo(page)).toHaveText('124 BPM');
    expect(await tempo(page)).toBe(124);
  });

  test('glisser la valeur vers le haut accélère, vers le bas ralentit @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const b = await surLaValeur(page);
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    await page.mouse.down();
    await page.mouse.move(x, y - 30, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => tempo(page)).toBeGreaterThan(120);
    const haut = await tempo(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 60, { steps: 6 });
    await page.mouse.up();
    await expect.poll(() => tempo(page)).toBeLessThan(haut);
    await expect(valeurTempo(page)).toHaveText(`${await tempo(page)} BPM`);
  });

  test('le tempo reste entre 60 et 240 BPM @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await surLaValeur(page);
    await glisserJusquauBout(page, 'bas', 60);
    await plusLent(page).click();
    await expect(valeurTempo(page)).toHaveText('60 BPM');
    await glisserJusquauBout(page, 'haut', 240);
    await plusRapide(page).click();
    await expect(valeurTempo(page)).toHaveText('240 BPM');
    expect(await tempo(page)).toBe(240);
  });

  test('« TAP » : des touches régulières donnent le tempo (une touche toutes les 750 ms = 80 BPM) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    // Horloge de la page figée : le rythme des touches est exact, indépendant de la vitesse de la machine.
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    await boutonTap(page).click();
    expect(await tempo(page)).toBe(120);   // une seule touche ne dit rien du rythme
    for (let i = 0; i < 3; i++) { await page.clock.runFor(750); await boutonTap(page).click(); }
    await expect(valeurTempo(page)).toHaveText('80 BPM');
    expect(await tempo(page)).toBe(80);
  });

  test('« TAP » : une pause de plus de deux secondes repart de zéro, et le tempo est borné à 60-240', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    await page.clock.install({ time: 0 });
    await page.clock.pauseAt(1000);
    await boutonTap(page).click();
    await page.clock.runFor(100);   // 600 BPM demandés : borné à 240
    await boutonTap(page).click();
    await expect(valeurTempo(page)).toHaveText('240 BPM');
    await page.clock.runFor(1500);
    await boutonTap(page).click();   // 1,5 s plus tard : encore dans la même série (moyenne des écarts)
    await expect.poll(() => tempo(page)).toBeLessThan(240);
    await page.clock.runFor(2500);   // pause > 2 s : une nouvelle série commence, le tempo ne bouge pas
    const avant = await tempo(page);
    await boutonTap(page).click();
    expect(await tempo(page)).toBe(avant);
    await page.clock.runFor(2000);   // 2 s : 30 BPM demandés, borné à 60
    await boutonTap(page).click();
    await expect(valeurTempo(page)).toHaveText('60 BPM');
  });

  test('changer le tempo marque le morceau « Non enregistré » ; Enregistrer le garde, même après rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirTempo(page);
    await plusRapide(page).click();
    await plusRapide(page).click();
    await expect(valeurTempo(page)).toHaveText('122 BPM');
    await fermerTempo(page);
    // l'état écrit (« Non enregistré » / « Enregistré à 08:53 ») n'existe qu'à l'ordinateur ; au téléphone un point de couleur le remplace
    if (!estMobile(page)) await expect(page.locator('#tb-etat-texte')).toHaveText('Non enregistré');
    await page.locator('#tb-save').click();
    if (!estMobile(page)) await expect(page.locator('#tb-etat-texte')).toHaveText(/^Enregistré à /);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('harmohubSongs')!)[0].bpm)).toBe(122);
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    expect(await tempo(page)).toBe(122);
    await ouvrirTempo(page);
    await expect(valeurTempo(page)).toHaveText('122 BPM');
  });

  test('le tempo règle la durée des mesures : à 240 BPM une mesure dure environ une seconde @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await surLaValeur(page);
    await glisserJusquauBout(page, 'haut', 240);
    await page.keyboard.press('Escape');
    await observerPassages(page);
    await boutonLecture(page).click();
    const ecart = await dureeMoyenneMesure(page);   // durée moyenne d'une mesure, en ms
    expect(ecart).toBeGreaterThan(700);   // ~1000 ms attendues ; la limite haute (1500) sépare nettement 240 BPM (1 s) de 120 BPM (2 s)
    expect(ecart).toBeLessThan(1500);
    await boutonStop(page).click();
    await expect.poll(() => enLecture(page)).toBe(false);   // (la case allumée après un Stop n'est pas vérifiée ici : voir L-05)
  });
});

test.describe('Tempo au téléphone @lecture @mobile', () => {
  test('le panneau « Lecture » (bouton « … ») donne le tempo, TAP, la vitesse et le métronome @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(page.getByRole('dialog', { name: 'Lecture', exact: true })).toBeHidden();
    await page.locator('#bl-plus').tap();
    const f = page.getByRole('dialog', { name: 'Lecture', exact: true });
    await expect(f).toBeVisible();
    await expect(valeurTempo(page)).toHaveText('120 BPM');
    await expect(boutonTap(page)).toBeVisible();
    await expect(page.getByRole('slider', { name: /Vitesse de lecture/ })).toBeVisible();
    await expect(f.getByRole('button', { name: 'Garder le métronome pendant la lecture de la grille' })).toBeVisible();
    await plusRapide(page).tap();
    await expect(valeurTempo(page)).toHaveText('121 BPM');
    await f.getByRole('button', { name: 'Fermer le panneau Lecture' }).tap();
    await expect(f).toBeHidden();
    await expect(page.getByRole('button', { name: /^Réglages du morceau : .*121 BPM/ })).toBeVisible();
  });
});
