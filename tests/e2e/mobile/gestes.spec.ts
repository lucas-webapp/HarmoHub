// MODULE « mobile » — les gestes du doigt : appui long (menu de la case), défilement, glisser une case, glisser le bord d'une case pour sa durée.
// Le toucher simple, le double-tape (feuille d'accord) et les annulations sont éprouvés par les modules grille et accord.
// Sous Android (Chromium) les gestes sont de vrais évènements tactiles du protocole DevTools. Sous iPhone (WebKit), Playwright n'a pas de geste composé :
// l'appui long y est rejoué par des évènements touchstart / touchend envoyés dans la page (voir `appuiLong`), les autres gestes sont ignorés avec la raison.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  C_AM_F_G, DEUX_PARTIES, caseN, cases, noms, appuiLong, glisserDoigt, defiler, menuContextuel, actionMenu, fenetre, boite, tientDansL_ecran, gesteComposeDisponible, annuler,
  defilementVertical, ongletGrille,
} from './aide-mobile';
import { repondreAuxConfirmations, selectionnees } from '../grille/aide-grille';
import { attendreAccord } from '../accord/aide-accord';

const SANS_GESTE = 'Playwright ne sait pas enchaîner un geste tactile (touchmove) en WebKit mobile : ce test ne tourne que sur Android (Chromium).';
const meta = (page: Page, partie: number, n: number) => caseN(page, partie, n).locator('.cell-meta');

test.describe('Appui long sur une case @mobile', () => {
  test('un appui long ouvre le menu de la case, dans l\'écran, sans la sélectionner ni ouvrir la feuille @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await expect(menuContextuel(page)).toBeHidden();
    await appuiLong(page, caseN(page, 0, 1));
    const m = menuContextuel(page);
    await expect(m).toBeVisible();
    await tientDansL_ecran(page, m);
    for (const n of ['Modifier', 'Renommer', 'Dupliquer', 'Octave +1', 'Octave -1', 'Séquenceur', 'Intensité…', 'Supprimer'])
      await expect(actionMenu(page, n)).toBeVisible();
    await expect(actionMenu(page, /Copier l'accord/)).toBeVisible();
    await expect(actionMenu(page, /Copier le rythme/)).toBeVisible();
    // le relâchement du doigt n'est pas un toucher : ni sélection, ni feuille d'accord
    await expect(selectionnees(page)).toHaveCount(0);
    await expect(fenetre(page)).toBeHidden();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'F', 'C']);
    expect(garde.bloquees).toEqual([]);
  });

  test('un toucher bref ne l\'ouvre pas : il sélectionne la case', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await caseN(page, 0, 1).tap();
    await expect(caseN(page, 0, 1)).toHaveClass(/\bselected\b/);
    await expect(menuContextuel(page)).toBeHidden();
  });

  test('un doigt qui bouge pendant l\'appui n\'ouvre pas le menu', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    test.skip(!gesteComposeDisponible(page), SANS_GESTE);
    const b = await boite(caseN(page, 0, 1));
    const depart = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await glisserDoigt(page, depart, { x: depart.x + 40, y: depart.y }, 5);
    await expect(menuContextuel(page)).toBeHidden();
  });

  test('toucher à côté referme le menu', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await appuiLong(page, caseN(page, 0, 1));
    await expect(menuContextuel(page)).toBeVisible();
    await ongletGrille(page).tap();
    await expect(menuContextuel(page)).toBeHidden();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'F', 'C']);
  });

  test('« Dupliquer » ajoute une copie juste après la case, une annulation la retire @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await appuiLong(page, caseN(page, 0, 1));
    await actionMenu(page, 'Dupliquer').tap();
    await expect(menuContextuel(page)).toBeHidden();
    expect(await noms(page)).toEqual(['C', 'Am', 'Am', 'F', 'G']);
    await annuler(page).tap();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('« Octave +1 » puis « Octave -1 » changent l\'octave affichée de la case', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await expect(meta(page, 0, 1)).toHaveText('O3');
    await appuiLong(page, caseN(page, 0, 1));
    await actionMenu(page, 'Octave +1').tap();
    await expect(meta(page, 0, 1)).toHaveText('O4');
    await attendreAccord(page, 0, 1, { octave: 4 });
    await appuiLong(page, caseN(page, 0, 1));
    await actionMenu(page, 'Octave -1').tap();
    await actionMenu(page, 'Octave -1').waitFor({ state: 'hidden' });
    await appuiLong(page, caseN(page, 0, 1));
    await actionMenu(page, 'Octave -1').tap();
    await expect(meta(page, 0, 1)).toHaveText('O2');
    await attendreAccord(page, 0, 1, { octave: 2 });
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('« Renommer » remplace le nom par un champ : « Dm7 » puis Entrée renomme l\'accord @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await appuiLong(page, caseN(page, 0, 1));
    await actionMenu(page, 'Renommer').tap();
    const champ = caseN(page, 0, 1).locator('.cell-sym-input');
    await expect(champ).toBeVisible();
    await champ.fill('Dm7');
    await champ.press('Enter');
    await expect(caseN(page, 0, 1).locator('.cell-sym')).toHaveText('Dm7');
    expect(await noms(page)).toEqual(['C', 'Dm7', 'F', 'G']);
    await attendreAccord(page, 0, 1, { root: 'D', quality: 'min7' });
  });

  test('« Supprimer » demande confirmation ; refuser ne change rien, accepter retire l\'accord @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    const messages = repondreAuxConfirmations(page, false);
    await appuiLong(page, caseN(page, 0, 1));
    await actionMenu(page, 'Supprimer').tap();
    await expect.poll(() => messages.length).toBeGreaterThan(0);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
    page.removeAllListeners('dialog');
    repondreAuxConfirmations(page, true);
    await appuiLong(page, caseN(page, 0, 1));
    await actionMenu(page, 'Supprimer').tap();
    await expect.poll(() => noms(page)).toEqual(['C', 'F', 'G']);
  });

  test('« Modifier » ouvre la feuille de l\'accord, comme le double-tape : onglet Accord, contenu Accord', async ({ ouvrirAppli }) => {
    test.fail(true, 'M-01 (bugs.md) : « Modifier » ouvre la feuille avec l\'onglet « Voicing » marqué alors que le haut de la feuille montre le contenu de l\'onglet Accord.');
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await appuiLong(page, caseN(page, 0, 1));
    await actionMenu(page, 'Modifier').tap();
    await expect(fenetre(page)).toBeVisible();
    await expect(fenetre(page)).toHaveAccessibleName('Accord Am');
    await expect(fenetre(page).locator('[data-bulle="root"][data-valeur="A"]')).toHaveAttribute('aria-pressed', 'true');   // le contenu visible est celui de l'onglet Accord
    await expect(fenetre(page).getByRole('button', { name: 'Accord', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(fenetre(page).getByRole('button', { name: 'Voicing', exact: true })).toHaveAttribute('aria-pressed', 'false');
  });

  test('« Modifier » ouvre bien la feuille de la case appuyée, et « Fermer » la referme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await appuiLong(page, caseN(page, 0, 1));
    await actionMenu(page, 'Modifier').tap();
    await expect(fenetre(page)).toBeVisible();
    await expect(fenetre(page)).toHaveAccessibleName('Accord Am');
    await expect(fenetre(page).locator('[data-bulle="root"][data-valeur="A"]')).toHaveAttribute('aria-pressed', 'true');
    await fenetre(page).getByRole('button', { name: 'Fermer' }).tap();
    await expect(fenetre(page)).toBeHidden();
  });

  test('« Séquenceur » ouvre la feuille d\'accord sur l\'onglet Rythme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await appuiLong(page, caseN(page, 0, 2));
    await actionMenu(page, 'Séquenceur').tap();
    await expect(fenetre(page)).toHaveAccessibleName('Accord F');
    await expect(fenetre(page).getByRole('button', { name: 'Rythme', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('« Copier l\'accord » puis « Coller l\'accord » sur une autre case reprend l\'accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await appuiLong(page, caseN(page, 0, 1));
    await actionMenu(page, /Copier l'accord/).tap();
    await appuiLong(page, caseN(page, 0, 3));
    await actionMenu(page, /Coller l'accord/).tap();
    await expect.poll(() => noms(page)).toEqual(['C', 'Am', 'F', 'Am']);
  });
});

test.describe('Défilement et glisser au doigt @mobile', () => {
  test('un glissé qui part d\'une case fait défiler la page : ni sélection, ni menu, ni feuille d\'accord @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    test.skip(!gesteComposeDisponible(page), SANS_GESTE);
    const b = await boite(caseN(page, 0, 1));
    expect(await defilementVertical(page)).toBe(0);
    await defiler(page, 250, { x: b.x + b.width / 2, y: b.y + b.height / 2 + 150 });
    // départ sur une case, balayage rapide vers le haut
    await glisserDoigt(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, { x: b.x + b.width / 2, y: b.y - 150 }, 6);
    await expect.poll(() => defilementVertical(page)).toBeGreaterThan(100);
    await expect(selectionnees(page)).toHaveCount(0);
    await expect(menuContextuel(page)).toBeHidden();
    await expect(fenetre(page)).toBeHidden();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'F', 'C']);
  });

  test('glisser une case d\'un coup d\'épaule, après l\'avoir visée, la déplace dans sa partie ; une annulation la remet @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    test.skip(!gesteComposeDisponible(page), SANS_GESTE);
    const a = await boite(caseN(page, 0, 1)), f = await boite(caseN(page, 0, 2));
    await glisserEnVisant(page, { x: a.x + a.width / 2, y: a.y + a.height / 2 }, { x: f.x + f.width * 0.7, y: f.y + f.height / 2 });
    await expect.poll(() => noms(page)).toEqual(['C', 'F', 'Am', 'G']);
    await expect(menuContextuel(page)).toBeHidden();
    await annuler(page).tap();
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('glisser le bord d\'une case au doigt change sa durée ; la page ne défile pas pendant ce geste', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    test.skip(!gesteComposeDisponible(page), SANS_GESTE);
    const poignee = caseN(page, 0, 3).locator('[title="Glisser pour changer la durée"]').last();
    const p = await boite(poignee);
    const depart = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
    await glisserDoigt(page, depart, { x: depart.x - 70, y: depart.y }, 10);
    await expect.poll(async () => Number((await page.evaluate(() => JSON.parse(localStorage.getItem('myProgression')!).sections[0].chords[3].beats)))).toBeLessThan(4);
    expect(await defilementVertical(page)).toBe(0);
    await expect(cases(page)).toHaveCount(4);
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G']);
  });
});

// Glisser une case au doigt : « attraper une case pour la déplacer demande de la viser d'abord » — le doigt marque un temps d'arrêt (plus de 300 ms, moins de
// 550 ms, sinon c'est l'appui long) avant de partir ; un départ immédiat, surtout vertical, est un défilement.
async function glisserEnVisant(page: Page, de: { x: number; y: number }, vers: { x: number; y: number }) {
  const c = await page.context().newCDPSession(page);
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [de] });
  await new Promise<void>(fin => setTimeout(fin, 380));   // temps d'arrêt du doigt, inhérent au geste
  for (let i = 1; i <= 14; i++) {
    await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: de.x + (vers.x - de.x) * i / 14, y: de.y + (vers.y - de.y) * i / 14 }] });
    await new Promise<void>(fin => setTimeout(fin, 16));
  }
  await new Promise<void>(fin => setTimeout(fin, 150));
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.detach();
}
