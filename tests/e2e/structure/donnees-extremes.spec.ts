// MODULE « structure » — DONNÉES HOSTILES ET EXTRÊMES (plan, point G) : les noms et les commentaires sont insérés dans du HTML (fenêtre, feuille imprimable) ;
// une structure peut être très longue ; un ×N peut monter à 99.
import { test, expect } from '../support/fixtures';
import {
  morceauTroisParties, ouvrirStructure, lire, titresLignes, lignes, renommer, commenter, ajouterPartie, plus, ouvrirApercu, feuille, structureDuMorceau,
} from './aide-structure';
import { defilementHorizontal } from '../mobile/aide-mobile';

const HOSTILE = `<img src=x onerror="window.__xss=1">"'&amp; 😀 <b>gras</b>`;

test.describe('Données hostiles et extrêmes @structure', () => {
  test('un nom et un commentaire pleins de HTML s\'affichent tels quels (fenêtre, feuille, rechargement), rien ne s\'exécute @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await renommer(page, 0, HOSTILE);
    await commenter(page, 0, HOSTILE);
    expect(await titresLignes(page)).toEqual([HOSTILE, 'Refrain', 'Pont']);
    expect((await lire(page)).lignes[0].notes).toEqual([HOSTILE]);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    await expect(page.locator('#structure-panel .struct-row img')).toHaveCount(0);        // aucune balise n'a été créée
    await ouvrirApercu(page);
    await expect(feuille(page).locator('.sf-nom').first()).toHaveText(HOSTILE);
    await expect(feuille(page).locator('.sf-note-txt').first()).toHaveText(HOSTILE);
    expect(await feuille(page).locator('img').count()).toBe(0);
    expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
    expect((await structureDuMorceau(page))[0].label).toBe(HOSTILE);                         // et le morceau l'a gardé tel quel
  });

  test('un commentaire de 5 000 caractères est gardé en entier et ne casse pas la mise en page', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    const long = ('mot ' + 'x'.repeat(46)).repeat(100).slice(0, 5000);
    await commenter(page, 1, long);
    expect((await structureDuMorceau(page))[1].notes[0].texte).toHaveLength(5000);
    expect(await defilementHorizontal(page)).toBeLessThanOrEqual(0);
    const ligne = (await lignes(page).nth(1).boundingBox())!, note = (await lignes(page).nth(1).locator('.struct-note').first().boundingBox())!;
    expect(note.x + note.width).toBeLessThanOrEqual(ligne.x + ligne.width + 1);
  });

  test('40 passages : ajout, total et déroulé justes ; chaque ajout reste rapide', async ({ ouvrirAppli }) => {
    test.setTimeout(120_000);
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    const debut = Date.now();
    for (let i = 0; i < 37; i++) await ajouterPartie(page, [/^Couplet/, /^Refrain/, /^Pont/][i % 3]);
    expect(Date.now() - debut).toBeLessThan(60_000);                                          // marge large : on vise un seuil d'absurdité, pas un chrono
    await expect(lignes(page)).toHaveCount(40);
    const v = await lire(page);
    expect(v.parties).toBe('40 passage(s)');
    // 3 lignes de départ (3 + 4 + 2 mesures) + 37 ajouts qui tournent Couplet (3) / Refrain (4) / Pont (2) : 13 Couplet, 12 Refrain, 12 Pont.
    expect(v.mesures).toBe(`${9 + 13 * 3 + 12 * 4 + 12 * 2} mesures`);
    expect(v.deroule.split(' · ')).toHaveLength(40);
  });

  test('« + » jusqu\'à ×99 sur chaque ligne : la somme suit, ×99 est le plafond', async ({ ouvrirAppli }) => {
    test.setTimeout(120_000);
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    for (let i = 0; i < 98; i++) await plus(page, 2).evaluate((b: HTMLElement) => b.click());   // Pont (2 mesures) : ×99 sans passer par 98 clics de souris
    await expect(lignes(page).nth(2).locator('.struct-rep')).toHaveText('×99');
    await plus(page, 2).evaluate((b: HTMLElement) => b.click());                               // au-delà : rien
    await expect(lignes(page).nth(2).locator('.struct-rep')).toHaveText('×99');
    expect((await lire(page)).mesures).toBe(`${3 + 4 + 2 * 99} mesures`);
    expect(await defilementHorizontal(page)).toBeLessThanOrEqual(0);
  });
});
