// MODULE « structure » — l'ouverture de la fenêtre « Structure du morceau » et ce qu'elle affiche : la somme (mesures, durée, parties), le déroulé,
// une ligne par occurrence (nom, nombre de mesures, position, accords écrits en mesures). Ordinateur et téléphone : la fenêtre est la même.
import { test, expect } from '../support/fixtures';
import {
  C_AM_F_G, morceauTroisParties, ouvrirStructure, retourGrille, ongletStructure, ongletGrille, fenetre, lignes, lire, titresLignes, appuyer, estMobile,
  ouvrirTempo, fermerTempo, plusLent, ajoutPartie, PARTIES, COUPLET, REFRAIN, noms, titres,
} from './aide-structure';

test.describe('Ouverture et contenu @structure', () => {
  test('l\'onglet « Structure » ouvre la fenêtre, « Grille » la referme @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await expect(fenetre(page)).toBeHidden();
    await expect(ongletGrille(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(ongletStructure(page)).toHaveAttribute('aria-pressed', 'false');
    await ouvrirStructure(page);
    await expect(ongletStructure(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(ongletGrille(page)).toHaveAttribute('aria-pressed', 'false');
    await retourGrille(page);
    await expect(ongletGrille(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(ongletStructure(page)).toHaveAttribute('aria-pressed', 'false');
    expect(garde.bloquees).toEqual([]);
  });

  test('un second clic sur l\'onglet « Structure » referme la fenêtre', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await appuyer(page, ongletStructure(page));
    await expect(fenetre(page)).toBeHidden();
    await expect(ongletGrille(page)).toHaveAttribute('aria-pressed', 'true');
    await ouvrirStructure(page);   // et on peut la rouvrir
  });

  test('Échap referme la fenêtre @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await page.keyboard.press('Escape');
    await expect(fenetre(page)).toBeHidden();
    await expect(ongletGrille(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('la somme dit les mesures, la durée au tempo du morceau et le nombre de parties @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    const v = await lire(page);
    // 12 + 16 + 8 temps = 36 temps = 9 mesures à 4 temps ; 9 mesures à 120 BPM : 36 × 0,5 s = 18 s.
    expect(v.mesures).toBe('9 mesures');
    expect(v.duree).toBe('0 min 18 s à 120 BPM');
    expect(v.parties).toBe('3 partie(s)');
  });

  test('une ligne par partie : nom, longueur, position en mesures et accords écrits en mesures @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    const v = await lire(page);
    expect(v.deroule).toBe('Couplet · Refrain · Pont');
    expect(v.lignes.map(l => l.titre)).toEqual(['Couplet', 'Refrain', 'Pont']);
    expect(v.lignes.map(l => l.mesures)).toEqual(['3 mes.', '4 mes.', '2 mes.']);
    expect(v.lignes.map(l => l.position)).toEqual(['mes. 1–3', 'mes. 4–7', 'mes. 8–9']);
    // « | » sépare les mesures ; deux accords dans la même mesure s'écrivent côte à côte ; un accord tenu sur plusieurs mesures devient « % ».
    expect(v.lignes.map(l => l.accords)).toEqual(['| C | Am | F G |', '| F | % | C | G |', '| Dm | G7 |']);
    expect(v.lignes.map(l => l.rep)).toEqual(['', '', '']);   // ×1 : pas d'étiquette
    await expect(lignes(page)).toHaveCount(3);
  });

  test('la fenêtre ne change ni la grille ni le morceau', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    const avant = { noms: await noms(page), titres: await titres(page) };
    await ouvrirStructure(page);
    await retourGrille(page);
    expect(await noms(page)).toEqual(avant.noms);
    expect(await titres(page)).toEqual(avant.titres);
    expect(avant.noms).toEqual(['C', 'Am', 'F', 'G', 'F', 'C', 'G', 'Dm', 'G7']);
  });

  test('un morceau vide : zéro mesure, une partie « vide » et le message d\'attente', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await ouvrirStructure(page);
    const v = await lire(page);
    expect(v.mesures).toBe('0 mesures');
    expect(v.duree).toBe('0 min 00 s à 120 BPM');
    expect(v.parties).toBe('0 partie(s)');
    expect(v.lignes.map(l => l.titre)).toEqual(['Partie 1']);
    await expect(lignes(page).first()).toContainText('vide');
    await expect(fenetre(page)).toContainText('Aucun accord pour l\'instant');
    await expect(ajoutPartie(page)).toBeVisible();
  });

  test('une partie vide de la grille est une ligne « vide » qui ne compte pas dans les parties', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties([...PARTIES, { titre: 'Outro', accords: [] }]));
    await ouvrirStructure(page);
    const v = await lire(page);
    expect(v.lignes.map(l => l.titre)).toEqual(['Couplet', 'Refrain', 'Pont', 'Outro']);
    await expect(lignes(page).nth(3)).toContainText('vide');
    expect(v.parties).toBe('3 partie(s)');
    expect(v.mesures).toBe('9 mesures');
    expect(v.deroule).toBe('Couplet · Refrain · Pont');
  });

  test('les parties de même nom, variations comprises, partagent la couleur de leur liseré', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties([
      { titre: 'Couplet', accords: COUPLET }, { titre: 'Refrain', accords: REFRAIN }, { titre: 'Couplet (variation)', accords: COUPLET },
    ]));
    await ouvrirStructure(page);
    const famille = (n: number) => lignes(page).nth(n).locator('.struct-famille').evaluate(e => [...e.classList].find(c => /^struct-famille-\d+$/.test(c)) || '');
    const [c1, r, c2] = [await famille(0), await famille(1), await famille(2)];
    expect(c1).not.toBe('');
    expect(c2).toBe(c1);       // « Couplet (variation) » est de la famille « Couplet »
    expect(r).not.toBe(c1);
    // la couleur affichée suit : même liseré pour les deux « Couplet », autre pour le « Refrain »
    const couleur = (n: number) => lignes(page).nth(n).locator('.struct-famille').evaluate(e => getComputedStyle(e).backgroundColor);
    expect(await couleur(2)).toBe(await couleur(0));
    expect(await couleur(1)).not.toBe(await couleur(0));
  });

  test('un tempo plus lent allonge la durée affichée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirTempo(page);
    for (let i = 0; i < 20; i++) await plusLent(page).click();
    await expect(page.locator('#bl-tempo-pop-val')).toHaveText('100 BPM');
    await fermerTempo(page);
    await ouvrirStructure(page);
    // 36 temps à 100 BPM : 36 × 0,6 s = 21,6 s
    const v = await lire(page);
    expect(v.duree).toBe('0 min 22 s à 100 BPM');
    expect(v.mesures).toBe('9 mesures');
  });

  const regler34 = async (page: import('@playwright/test').Page) => {
    if (estMobile(page)) {
      await page.locator('#song-summary').tap();
      await page.getByRole('group', { name: 'Réglages du morceau' }).getByRole('button', { name: /^Mesure/ }).tap();
      await page.getByRole('listbox', { name: 'Mesure' }).getByText('3/4', { exact: true }).tap();
      await expect(page.locator('#song-summary')).toContainText('3/4');
    } else {
      await page.getByRole('button', { name: /^Mesure/ }).click();
      await page.getByRole('listbox', { name: 'Mesure' }).getByText('3/4', { exact: true }).click();
      await expect(page.getByRole('button', { name: /^Mesure/ })).toContainText('3/4');
    }
  };

  test('en 3/4 les mesures se recomptent sur trois temps, la durée ne change pas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await regler34(page);
    await ouvrirStructure(page);
    const v = await lire(page);
    // Couplet : 12 temps = 4 mesures de 3 temps ; Refrain : 16 temps = 5,3 mesures (une mesure entamée s'écrit en décimal) ; durée inchangée : 36 × 0,5 s.
    expect(v.lignes.map(l => l.mesures)).toEqual(['4 mes.', '5.3 mes.', '2.7 mes.']);
    expect(v.lignes[0].position).toBe('mes. 1–4');
    expect(v.duree).toBe('0 min 18 s à 120 BPM');
  });

  test('en 3/4 le total de 36 temps s\'écrit « 12 mesures », sans décimale (R-01)', async ({ ouvrirAppli }) => {
    test.fail(true, 'R-01 (bugs.md) : le total s\'affiche « 12.0 mesures » (somme de fractions non arrondie)');
    const page = await ouvrirAppli(morceauTroisParties());
    await regler34(page);
    await ouvrirStructure(page);
    expect((await lire(page)).mesures).toBe('12 mesures');
  });

  test('un morceau d\'une seule partie : une seule ligne', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet']);
    const v = await lire(page);
    expect(v.mesures).toBe('4 mesures');
    expect(v.lignes[0].accords).toBe('| C | Am | F | G |');
  });
});
