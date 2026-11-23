// MODULE « lecture » — la plage à boucler (bande orange) se TRACE EN DIRECT, dans la grille comme dans le séquenceur.
// Retour de l'utilisateur du 23/11 : « j'ai du mal à définir la barre dans la grille, surtout s'il y a plusieurs lignes », « j'aimerais que la barre se
// décide en même temps que je glisse la souris, là elle apparaît juste à la fin » et « des problèmes avec la barre orange quand le séquenceur est ouvert ».
// Tous les gestes sont de vrais gestes de souris (down / move / up) ; on lit l'état (`app.loopRange`, bandes dessinées) PENDANT le glisser, avant le relâché.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import { C_AM_F_G, plage, caseN } from './aide-lecture';
import { ouvrirSequenceur, grille } from '../sequenceur/aide-sequenceur';

const ROOTS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const accordsN = (n: number) => Array.from({ length: n }, (_, i) => ({ root: ROOTS[i % 7], quality: '' }));

const bandesGrille = (page: Page) => page.locator('#progression-sections .loop-range-bar');
const bandeSeq = (page: Page) => grille(page).locator('.sq-boucle');
// La zone de règle SOUS l'accord n de la partie 0 (une par accord quand chacun tient sur une ligne).
const regle = (page: Page, n: number, partie = 0) => page.locator('#progression-sections .chord-grid').nth(partie).locator('.row-regle').nth(n);

async function centre(loc: ReturnType<Page['locator']>, fx = 0.5, fy = 0.5) {
  const b = (await loc.boundingBox())!;
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
}

test.describe('Plage à boucler tracée en direct @lecture', () => {
  test('le glisser démarre n\'importe où sur la règle sous l\'accord, pas seulement sur le chiffre de la mesure @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    // le chiffre de la mesure 2 occupe l'extrémité gauche de la case ; on appuie aux trois quarts de sa largeur, loin du chiffre
    const depart = await centre(regle(page, 1), 0.75);
    const arrivee = await centre(caseN(page, 0, 2));
    await page.mouse.move(depart.x, depart.y);
    await page.mouse.down();
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 1 });   // posée dès l'appui
    await page.mouse.move(arrivee.x, depart.y, { steps: 6 });
    await page.mouse.up();
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 2 });
  });

  test('la plage suit le pointeur PENDANT le glisser (avant le relâché), sans redessiner la grille @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: accordsN(8) });
    const d = await centre(regle(page, 1), 0.7);
    // on marque un nœud de la grille : un redessin complet le détacherait
    await page.evaluate(() => { (window as any).__noeud = document.querySelector('#progression-sections .grid-cell[data-index="0"]'); });
    await page.mouse.move(d.x, d.y);
    await page.mouse.down();
    const vus: number[] = [];
    for (const n of [2, 3]) {
      const c = await centre(caseN(page, 0, n));
      await page.mouse.move(c.x, d.y, { steps: 5 });
      const r = await plage(page);
      vus.push(r!.endIndex);
      await expect(bandesGrille(page)).toHaveCount(1);
      expect(await page.evaluate(() => (window as any).__noeud.isConnected)).toBe(true);   // la grille n'a pas été reconstruite
    }
    expect(vus).toEqual([2, 3]);   // la fin a bougé à chaque étape, bouton toujours enfoncé
    await page.mouse.up();
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 3 });
    await expect(bandesGrille(page)).toHaveCount(1);
    // au relâché, tout est remis d'aplomb : la frise de la barre de lecture porte la plage
    await expect(page.locator('#bl-frise .bl-frise-plage')).toHaveCount(1);
  });

  test('plusieurs lignes : la plage se trace d\'une ligne à l\'autre, une bande par ligne, en direct @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: accordsN(16) });
    const lignes = new Set((await Promise.all([0, 4, 8, 12].map(n => caseN(page, 0, n).boundingBox()))).map(b => Math.round(b!.y)));
    expect(lignes.size).toBe(4);   // quatre lignes dans la partie
    const d = await centre(regle(page, 1), 0.7);
    await page.mouse.move(d.x, d.y);
    await page.mouse.down();
    const c9 = await centre(caseN(page, 0, 9));
    await page.mouse.move(c9.x, c9.y, { steps: 12 });
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 9 });
    await expect(bandesGrille(page)).toHaveCount(3);   // lignes 1, 2 et 3, avant même le relâché
    // on remonte d'une ligne sans lâcher : la plage raccourcit
    const c5 = await centre(caseN(page, 0, 5));
    await page.mouse.move(c5.x, c5.y, { steps: 6 });
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 5 });
    await expect(bandesGrille(page)).toHaveCount(2);
    await page.mouse.up();
  });

  test('le pointeur qui déborde de la carte ne fige pas la plage : elle suit jusqu\'à l\'accord le plus proche @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: accordsN(16) });
    const d = await centre(regle(page, 1), 0.7);
    await page.mouse.move(d.x, d.y);
    await page.mouse.down();
    const carte = (await page.locator('#progression-sections .chord-grid').first().boundingBox())!;
    const c5 = await centre(caseN(page, 0, 5));
    // On entre dans la carte, sur la 2e ligne, puis on SAUTE d'un seul pas hors de la carte (aucun point intermédiaire dans la carte).
    await page.mouse.move(c5.x, c5.y, { steps: 6 });
    expect((await plage(page))!.endIndex).toBe(5);
    // loin à droite de la carte, à la hauteur de la 2e ligne : le dernier accord de cette ligne (index 7)
    await page.mouse.move(carte.x + carte.width + 160, c5.y);
    expect((await plage(page))!.endIndex).toBe(7);
    // loin à gauche de la carte, à la hauteur de la 3e ligne : le premier accord de cette ligne (index 8)
    const c9 = await centre(caseN(page, 0, 9));
    await page.mouse.move(carte.x - 160, c9.y);
    expect((await plage(page))!.endIndex).toBe(8);
    await page.mouse.up();
  });

  test('séquenceur ouvert, la grille est petite : tenir le pointeur en bas la fait défiler et la plage s\'allonge @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: accordsN(48) });
    await ouvrirSequenceur(page);
    const zone = await page.evaluate(() => {
      let el: HTMLElement | null = document.querySelector('#progression-sections');
      while (el && el !== document.body) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 2) { const r = el.getBoundingClientRect(); return { bas: r.bottom, haut: r.top, h: el.clientHeight, tot: el.scrollHeight }; }
        el = el.parentElement;
      }
      return null;
    });
    expect(zone).not.toBeNull();
    expect(zone!.tot).toBeGreaterThan(zone!.h * 1.5);   // la partie est bien plus haute que la fenêtre
    const d = await centre(regle(page, 1), 0.7);
    await page.mouse.move(d.x, d.y);
    await page.mouse.down();
    await page.mouse.move(d.x, zone!.bas - 10, { steps: 8 });   // le bord bas de la zone visible, puis on ne bouge plus
    const lire = () => page.evaluate(() => (window as any).app.loopRange.endIndex as number);
    const avant = await lire();
    await expect.poll(lire, { timeout: 8000 }).toBeGreaterThan(avant + 6);   // la zone défile toute seule : la fin avance de plusieurs lignes
    await page.mouse.up();
    expect((await plage(page))!.startIndex).toBe(1);
  });

  test('séquenceur ouvert : la plage se trace sur la règle du séquenceur en direct, avant le relâché @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    const t1 = (await grille(page).locator('.sq-temps[data-c="1"][data-k="0"]').boundingBox())!;
    const y = t1.y + t1.height / 2;
    await page.mouse.move(t1.x + 8, y);
    await page.mouse.down();
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 1 });   // dès l'appui
    await expect(bandeSeq(page)).toHaveCount(1);
    const l1 = (await bandeSeq(page).boundingBox())!.width;
    const t3 = (await grille(page).locator('.sq-temps[data-c="3"][data-k="0"]').boundingBox())!;
    await page.mouse.move(t3.x + 8, y, { steps: 10 });
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 3 });
    expect((await bandeSeq(page).boundingBox())!.width).toBeGreaterThan(l1 * 2.5);   // la bande du séquenceur a grandi sous la main
    await expect(bandesGrille(page)).toHaveCount(1);   // et celle de la grille aussi
    await page.mouse.up();
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 3 });
  });

  test('séquenceur : le pointeur qui quitte la règle (vers le bas, ou au-delà de la grille) ne fige pas la plage @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    const t0 = (await grille(page).locator('.sq-temps[data-c="0"][data-k="0"]').boundingBox())!;
    const g = (await grille(page).boundingBox())!;
    await page.mouse.move(t0.x + 8, t0.y + 8);
    await page.mouse.down();
    const t1 = (await grille(page).locator('.sq-temps[data-c="1"][data-k="0"]').boundingBox())!;
    await page.mouse.move(t1.x + 20, t0.y + 8, { steps: 6 });   // sur la règle, accord 1
    expect((await plage(page))!.endIndex).toBe(1);
    await page.mouse.move(t1.x + 20, t0.y + 90);   // d'un saut, dans les lignes de notes, à l'aplomb de l'accord 1 : la plage reste sur l'accord 1
    expect((await plage(page))!.endIndex).toBe(1);
    await page.mouse.move(Math.min(g.x + g.width + 200, page.viewportSize()!.width - 2), t0.y + 40);   // d'un saut, au-delà du bord droit de la grille (sans sortir de la fenêtre) : le dernier accord
    expect((await plage(page))!.endIndex).toBe(3);
    await page.mouse.up();
  });

  test('séquenceur : tirer la bande déjà posée la redéfinit au lieu de la supprimer ; un simple clic la retire @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    // une plage sur les accords 0 à 1
    const t0 = (await grille(page).locator('.sq-temps[data-c="0"][data-k="0"]').boundingBox())!;
    const t1 = (await grille(page).locator('.sq-temps[data-c="1"][data-k="4"]').boundingBox())!;
    await page.mouse.move(t0.x + 8, t0.y + 8);
    await page.mouse.down();
    await page.mouse.move(t1.x + 4, t0.y + 8, { steps: 6 });
    await page.mouse.up();
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 0, endSection: 0, endIndex: 1 });
    // on appuie au milieu de la bande (sur l'accord 1) et on glisse vers l'accord 3 : nouvelle plage 1 → 3, la bande n'est pas supprimée
    const b = (await bandeSeq(page).boundingBox())!;
    const t3 = (await grille(page).locator('.sq-temps[data-c="3"][data-k="0"]').boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.75, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(t3.x + 8, b.y + b.height / 2, { steps: 8 });
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 3 });
    await page.mouse.up();
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 3 });
    // un simple clic sur la bande, sans bouger, la retire
    const b2 = (await bandeSeq(page).boundingBox())!;
    await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2);
    expect(await plage(page)).toBeNull();
    await expect(bandeSeq(page)).toHaveCount(0);
  });

  test('séquenceur : tirer le bout droit de la bande n\'étire que ce bord ; le bout gauche de même @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSequenceur(page);
    const t1 = (await grille(page).locator('.sq-temps[data-c="1"][data-k="0"]').boundingBox())!;
    const t2 = (await grille(page).locator('.sq-temps[data-c="2"][data-k="4"]').boundingBox())!;
    await page.mouse.move(t1.x + 8, t1.y + 8);
    await page.mouse.down();
    await page.mouse.move(t2.x + 4, t1.y + 8, { steps: 6 });
    await page.mouse.up();
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 2 });
    // le bout droit vers l'accord 3
    const droit = (await bandeSeq(page).locator('.sq-boucle-bord.droite').boundingBox())!;
    const t3 = (await grille(page).locator('.sq-temps[data-c="3"][data-k="4"]').boundingBox())!;
    await page.mouse.move(droit.x + droit.width / 2, droit.y + droit.height / 2);
    await page.mouse.down();
    await page.mouse.move(t3.x + 4, droit.y + droit.height / 2, { steps: 8 });
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 1, endSection: 0, endIndex: 3 });   // avant le relâché
    await page.mouse.up();
    // le bout gauche vers l'accord 0 : la fin reste à 3
    const gauche = (await bandeSeq(page).locator('.sq-boucle-bord.gauche').boundingBox())!;
    const t0 = (await grille(page).locator('.sq-temps[data-c="0"][data-k="0"]').boundingBox())!;
    await page.mouse.move(gauche.x + gauche.width / 2, gauche.y + gauche.height / 2);
    await page.mouse.down();
    await page.mouse.move(t0.x + 8, gauche.y + gauche.height / 2, { steps: 8 });
    await page.mouse.up();
    expect(await plage(page)).toEqual({ startSection: 0, startIndex: 0, endSection: 0, endIndex: 3 });
  });

  test('téléphone : la règle n\'a pas de zone de saisie en plus (le geste du téléphone n\'a pas bougé) @mobile', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(page.locator('#progression-sections .chord-grid .row-measure').first()).toBeVisible();
    await expect(page.locator('#progression-sections .row-regle')).toHaveCount(0);
  });
});
