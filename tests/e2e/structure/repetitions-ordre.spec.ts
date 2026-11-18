// MODULE « structure » — réordonner (↑ ↓) et répéter (− +) les occurrences. Ces gestes changent le plan de jeu, JAMAIS la grille ; ils sont enregistrés
// aussitôt dans le morceau (survivent au rechargement) et ne sont pas annulables par « Annuler » (limite assumée de l'appli).
import { test, expect } from '../support/fixtures';
import {
  morceauTroisParties, ouvrirStructure, retourGrille, lire, titresLignes, repsLignes, moins, plus, monter, descendre, appuyer, lignes,
  noms, titres, structureStockee, structureDuMorceau, sidsParties,
  creerMorceau,
} from './aide-structure';

test.describe('Répéter et réordonner @structure', () => {
  test('« + » ajoute une répétition : ×2, mesures et durée recomptées, positions décalées, déroulé @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await expect(lignes(page).first().locator('.struct-rep')).toHaveText('×2');
    const v = await lire(page);
    expect(v.lignes[0].rep).toBe('×2');
    expect(v.mesures).toBe('12 mesures');                     // 3 × 2 + 4 + 2
    expect(v.duree).toBe('0 min 24 s à 120 BPM');
    expect(v.deroule).toBe('Couplet ×2 · Refrain · Pont');
    expect(v.lignes.map(l => l.position)).toEqual(['mes. 1–6', 'mes. 7–10', 'mes. 11–12']);
    expect(v.lignes.map(l => l.mesures)).toEqual(['3 mes.', '4 mes.', '2 mes.']);   // la longueur d'UNE occurrence ne change pas
    expect(v.parties).toBe('3 partie(s)');
    expect(garde.bloquees).toEqual([]);
  });

  test('« − » retire une répétition ; il ne descend pas sous ×1 @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 1));
    await appuyer(page, plus(page, 1));
    await expect(lignes(page).nth(1).locator('.struct-rep')).toHaveText('×3');
    await appuyer(page, moins(page, 1));
    await expect(lignes(page).nth(1).locator('.struct-rep')).toHaveText('×2');
    await appuyer(page, moins(page, 1));
    await expect(lignes(page).nth(1).locator('.struct-rep')).toHaveCount(0);   // ×1 : plus d'étiquette
    await appuyer(page, moins(page, 1));                                        // déjà à ×1 : sans effet, la ligne reste
    await appuyer(page, moins(page, 1));
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    expect(await repsLignes(page)).toEqual(['', '', '']);
    expect((await lire(page)).mesures).toBe('9 mesures');
    expect((await structureStockee(page)).map(o => o.rep)).toEqual([1, 1, 1]);
  });

  test('la répétition plafonne à ×99', async ({ ouvrirAppli }) => {
    test.setTimeout(90_000);
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    for (let i = 0; i < 100; i++) await appuyer(page, plus(page, 2));
    await expect(lignes(page).nth(2).locator('.struct-rep')).toHaveText('×99');
    const v = await lire(page);
    expect(v.lignes[2].position).toBe('mes. 8–205');     // 3 + 4 mesures avant, puis 2 × 99 = 198 mesures
    expect(v.mesures).toBe('205 mesures');
    expect((await structureStockee(page)).map(o => o.rep)).toEqual([1, 1, 99]);
  });

  test('« ↓ » descend la ligne, « ↑ » la remonte ; positions et déroulé suivent @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, descendre(page, 0));
    await expect.poll(() => titresLignes(page)).toEqual(['Refrain', 'Couplet', 'Pont']);
    let v = await lire(page);
    expect(v.deroule).toBe('Refrain · Couplet · Pont');
    expect(v.lignes.map(l => l.position)).toEqual(['mes. 1–4', 'mes. 5–7', 'mes. 8–9']);
    await appuyer(page, monter(page, 2));
    await expect.poll(() => titresLignes(page)).toEqual(['Refrain', 'Pont', 'Couplet']);
    v = await lire(page);
    expect(v.deroule).toBe('Refrain · Pont · Couplet');
    expect(v.lignes.map(l => l.accords)).toEqual(['| F | % | C | G |', '| Dm | G7 |', '| C | Am | F G |']);
    expect(v.mesures).toBe('9 mesures');                 // réordonner ne change ni le total ni la durée
    expect(v.duree).toBe('0 min 18 s à 120 BPM');
  });

  test('« ↑ » sur la première ligne et « ↓ » sur la dernière sont sans effet', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, monter(page, 0));
    await appuyer(page, descendre(page, 2));
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont']);
    await expect(monter(page, 0)).toBeVisible();   // ils restent affichés
    await expect(descendre(page, 2)).toBeVisible();
    expect((await lire(page)).deroule).toBe('Couplet · Refrain · Pont');
  });

  test('réordonner et répéter ne touchent pas la grille @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, descendre(page, 0));
    await appuyer(page, plus(page, 2));
    await appuyer(page, monter(page, 2));
    await expect.poll(() => titresLignes(page)).toEqual(['Refrain', 'Pont', 'Couplet']);
    await retourGrille(page);
    expect(await titres(page)).toEqual(['Couplet', 'Refrain', 'Pont']);                           // l'ordre de la grille est intact
    expect(await noms(page)).toEqual(['C', 'Am', 'F', 'G', 'F', 'C', 'G', 'Dm', 'G7']);
  });

  test('la structure survit au rechargement et est enregistrée avec le morceau @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await appuyer(page, descendre(page, 1));
    await expect.poll(() => titresLignes(page)).toEqual(['Couplet', 'Pont', 'Refrain']);
    const avant = await lire(page);
    // stockage : même plan dans le morceau en cours et dans la bibliothèque ; chaque occurrence renvoie à une partie (sid)
    const sids = await sidsParties(page);
    const stockee = await structureStockee(page);
    expect(stockee.map(o => o.sid)).toEqual([sids[0], sids[2], sids[1]]);
    expect(stockee.map(o => o.rep)).toEqual([2, 1, 1]);
    await expect.poll(async () => (await structureDuMorceau(page)).map(o => o.rep + ':' + o.sid)).toEqual(stockee.map(o => o.rep + ':' + o.sid));
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrirStructure(page);
    const apres = await lire(page);
    expect(apres.lignes.map(l => l.titre)).toEqual(['Couplet', 'Pont', 'Refrain']);
    expect(apres.lignes.map(l => l.rep)).toEqual(['×2', '', '']);
    expect(apres.deroule).toBe(avant.deroule);
    expect(apres.mesures).toBe(avant.mesures);
  });

  test('le morceau enregistré garde son propre plan : un autre morceau n\'est pas touché', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, plus(page, 0));
    await expect(lignes(page).first().locator('.struct-rep')).toHaveText('×2');
    await expect.poll(async () => (await structureDuMorceau(page)).map(o => o.rep)).toEqual([2, 1, 1]);
    // un nouveau morceau démarre sans le plan de l'autre
    await retourGrille(page);
    await creerMorceau(page, 'Autre');
    await ouvrirStructure(page);
    const v = await lire(page);
    expect(v.mesures).toBe('0 mesures');
    expect(v.lignes.map(l => l.rep)).toEqual(['']);
  });
});
