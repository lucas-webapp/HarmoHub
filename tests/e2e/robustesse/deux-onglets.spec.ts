// MODULE « robustesse » — DEUX ONGLETS ouverts sur la même appli, dans le même navigateur : ils partagent le même stockage local (morceaux, copie de travail,
// réglages) mais chacun a sa propre mémoire. L'un ne doit pas écraser le travail de l'autre, et un réglage doit suivre.
// (Deux APPAREILS, avec un compte connecté, c'est le module `synchro` ; ici, un seul appareil.)
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, cases, noms, collecterErreurs, ajouterAccords, ouvrirOnglet, titre, etat, boutonEnregistrer, bibliotheque, morceauxStockes, enregistrerSous,
  ouvrirMesMorceaux, fenetreMorceaux, ligne, creerMorceau, champNomMorceau, ouvrirMenuMorceau, menuMorceau, toast,
} from './aide-robustesse';
import type { Page } from '@playwright/test';

const DEUX = bibliotheque([{ id: 'a', nom: 'Alpha', accords: C_AM_F_G }, { id: 'b', nom: 'Bravo', accords: [{ root: 'D', quality: 'min' }, { root: 'G', quality: 'dom7' }] }], 'a');
// Les deux onglets réagissent au clavier et au clic : à tout instant, un seul est « devant » ; `bringToFront` fait ce que l'utilisateur fait en changeant d'onglet.
async function devant(page: Page) { await page.bringToFront(); }

test.describe('Deux onglets, un appareil @robustesse', () => {
  test('un second onglet ouvre le même morceau, avec les mêmes accords @critique', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli({ reglages: DEUX });
    const B = await ouvrirOnglet(context);
    await expect(titre(B)).toHaveText('Alpha');
    expect(await noms(B)).toEqual(await noms(A));
    expect(await noms(B)).toEqual(['C', 'Am', 'F', 'G']);
  });

  test('un réglage changé dans un onglet est suivi par l\'autre, sans rechargement (Verre dépoli) @ordinateur', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli({ accords: C_AM_F_G });
    const B = await ouvrirOnglet(context);
    await devant(A);
    await A.locator('#open-settings').click();
    await A.getByRole('dialog', { name: 'Paramètres' }).getByRole('switch', { name: 'Verre dépoli' }).click();
    await A.keyboard.press('Escape');
    await expect.poll(() => B.evaluate(() => document.documentElement.getAttribute('data-glass')), { timeout: 10_000 }).toBe('1');
    await expect.poll(() => A.evaluate(() => document.documentElement.getAttribute('data-glass'))).toBe('1');
  });

  test('un morceau enregistré dans un onglet est dans « Mes morceaux » de l\'autre, sans rechargement @critique', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli({ reglages: DEUX });
    const B = await ouvrirOnglet(context);
    await creerMorceau(A, 'Charlie');
    await ajouterAccords(A, ['E']);
    await boutonEnregistrer(A).click();
    await expect(etat(A)).toContainText('Enregistré');
    await devant(B);
    await ouvrirMesMorceaux(B);
    await expect(fenetreMorceaux(B).locator('.file-row')).toHaveCount(3);
    await expect(ligne(B, 'Charlie')).toHaveCount(1);
  });

  test('chaque onglet enregistre SON morceau neuf : les deux sont dans la bibliothèque, aucun n\'écrase l\'autre @critique', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli({ reglages: DEUX });
    const B = await ouvrirOnglet(context);
    await creerMorceau(A, 'Charlie');
    await ajouterAccords(A, ['E']);
    await boutonEnregistrer(A).click();
    await expect(etat(A)).toContainText('Enregistré');
    await devant(B);
    await creerMorceau(B, 'Delta');
    await ajouterAccords(B, ['D']);
    await boutonEnregistrer(B).click();
    await expect(etat(B)).toContainText('Enregistré');
    const noms_ = (await morceauxStockes(B)).map((m) => m.name).sort();
    expect(noms_).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    const stock = await morceauxStockes(A);
    expect(stock.find((m) => m.name === 'Charlie')!.accords).toEqual(['Emaj']);
    expect(stock.find((m) => m.name === 'Delta')!.accords).toEqual(['Dmaj']);
  });

  test('l\'un enregistre un ajout, l\'autre (resté sur l\'ancien état) ajoute le sien : les deux accords sont là @critique', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli({ reglages: DEUX });
    const B = await ouvrirOnglet(context);
    await ajouterAccords(A, ['E']);
    await boutonEnregistrer(A).click();
    await expect(etat(A)).toContainText('Enregistré');
    await devant(B);
    await ajouterAccords(B, ['D']);
    await boutonEnregistrer(B).click();
    await expect(etat(B)).toContainText('Enregistré');
    expect((await morceauxStockes(B)).find((m) => m.name === 'Alpha')!.accords).toEqual(['C', 'Amin', 'F', 'G', 'Emaj', 'Dmaj']);
    expect(await noms(B)).toEqual(['C', 'Am', 'F', 'G', 'E', 'D']);
  });

  // Z-07 (décidé le 25/11) : on ne sépare pas les onglets (ils se complètent), on les fait SUIVRE : l'onglet resté sur « Alpha » montre aussitôt le morceau ouvert par
  // l'autre, le dit, et ce qu'il y ajoute va dans le morceau qu'il montre — plus d'accord tapé « dans Alpha » qui atterrit en silence dans « Charlie ».
  test('Z-07 : l\'onglet resté sur « Alpha » suit le morceau ouvert par l\'autre, et le dit, avant le moindre geste @critique', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli({ reglages: DEUX });
    const B = await ouvrirOnglet(context);
    await expect(titre(B)).toHaveText('Alpha');
    await creerMorceau(A, 'Charlie');
    await ajouterAccords(A, ['E']);
    await boutonEnregistrer(A).click();
    await expect(etat(A)).toContainText('Enregistré');
    await devant(B);
    await expect(titre(B)).toHaveText('Charlie');   // B suit, sans qu'on touche à rien
    await expect(toast(B)).toContainText('Morceau changé dans un autre onglet');
    expect(await noms(B)).toEqual(['E']);
    // ce que B ajoute maintenant va dans « Charlie », qu'il montre, et « Alpha » ne reçoit rien
    await ajouterAccords(B, ['D']);
    await boutonEnregistrer(B).click();
    await expect(etat(B)).toContainText('Enregistré');
    expect((await morceauxStockes(B)).find((m) => m.name === 'Charlie')!.accords).toEqual(['Emaj', 'Dmaj']);
    expect((await morceauxStockes(B)).find((m) => m.name === 'Alpha')!.accords).toEqual(['C', 'Amin', 'F', 'G']);
  });

  test('Z-07 : Ctrl+Z de l\'onglet qui suit ne remet pas l\'ancien morceau dans la copie de travail', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli({ reglages: DEUX });
    const B = await ouvrirOnglet(context);
    await ajouterAccords(B, ['E']);   // B a un historique sur « Alpha »
    await devant(A);
    await creerMorceau(A, 'Charlie');
    await devant(B);
    await expect(titre(B)).toHaveText('Charlie');
    await B.keyboard.press('Control+z');
    await expect(titre(B)).toHaveText('Charlie');
    expect(await noms(B)).not.toContain('Am');   // le contenu d'« Alpha » n'est pas revenu dans la copie de travail
  });

  // Supprimer le morceau ouvert vide aussi la grille (F-02) ; l'autre onglet, qui le montrait encore, suit (Z-07) : il montre « Nouveau morceau » vide, et ce qu'on y ajoute
  // demande un nom à l'enregistrement au lieu d'être perdu ou écrit dans le vide.
  test('le morceau supprimé dans un onglet : l\'autre le suit (« Nouveau morceau »), et « Enregistrer » y demande un nom', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli({ reglages: DEUX });
    const B = await ouvrirOnglet(context);
    page_confirmations(A);
    await ouvrirMesMorceaux(A);
    await ligne(A, 'Alpha').getByRole('button', { name: 'Supprimer' }).click();
    await expect.poll(async () => (await morceauxStockes(A)).map((m) => m.name)).toEqual(['Bravo']);
    await devant(B);
    await expect(titre(B)).toHaveText('Nouveau morceau');
    expect(await noms(B)).toEqual([]);
    await ajouterAccords(B, ['D']);
    await boutonEnregistrer(B).click();
    await expect(champNomMorceau(B)).toBeVisible();
    await champNomMorceau(B).fill('Delta');
    await champNomMorceau(B).press('Enter');
    await expect(etat(B)).toContainText('Enregistré');
    const stock = await morceauxStockes(B);
    expect(stock.map((m) => m.name).sort()).toEqual(['Bravo', 'Delta']);
    expect(stock.find((m) => m.name === 'Delta')!.accords).toEqual(['Dmaj']);
  });

  test('fermer un onglet qui a du travail non enregistré n\'empêche pas l\'autre de continuer et d\'enregistrer @critique', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli({ reglages: DEUX });
    const B = await ouvrirOnglet(context);
    const erreurs = collecterErreurs(A);
    await devant(B);
    await ajouterAccords(B, ['E']);
    await expect(cases(B)).toHaveCount(5);
    await B.close({ runBeforeUnload: false });
    await devant(A);
    await ajouterAccords(A, ['D']);
    expect(await noms(A)).toContain('D');
    await boutonEnregistrer(A).click();
    await expect(etat(A)).toContainText('Enregistré');
    expect(erreurs).toEqual([]);
  });

  test('ouvrir l\'appli dans un second onglet pendant la lecture du premier : chacun joue de son côté, sans erreur', async ({ ouvrirAppli, context }) => {
    const A = await ouvrirAppli({ accords: C_AM_F_G });
    const erreurs = collecterErreurs(A);
    await A.getByRole('button', { name: 'Lecture', exact: true }).click();
    await expect.poll(() => A.evaluate(() => (window as any).app.isPlaying)).toBe(true);
    const B = await ouvrirOnglet(context);
    expect(await B.evaluate(() => (window as any).app.isPlaying)).toBe(false);
    expect(await noms(B)).toEqual(['C', 'Am', 'F', 'G']);
    await expect.poll(() => A.evaluate(() => (window as any).app.isPlaying)).toBe(true);
    await A.getByRole('button', { name: 'Stop', exact: true }).click();
    expect(erreurs).toEqual([]);
  });
});

// L'appli demande confirmation avant de supprimer un morceau (boîte native) : on accepte, comme l'utilisateur qui confirme.
function page_confirmations(page: Page) { page.on('dialog', (d) => void d.accept()); }
