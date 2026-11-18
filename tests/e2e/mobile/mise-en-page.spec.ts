// MODULE « mobile » — la mise en page « téléphone » (< 900 px) : largeurs courantes, paysage, seuil de 900 px franchi dans les deux sens, et
// l'ordinateur laissé intact (aucun élément propre au téléphone n'y apparaît).
import { test, expect } from '../support/fixtures';
import {
  DEUX_PARTIES, C_AM_F_G, caseN, titre, boutonEnregistrer, parametres, compte, onglets, annuler, retablir, resume, boutonAffichage, boutonSequenceurHaut, boutonAccord,
  boutonSection, bandeClavier, bandeGuitare, bandeFichier, barreLecture, boutonPlus, boite, defilementHorizontal, tientDansL_ecran, estMobile, panneauAjout, saisieAjout,
} from './aide-mobile';

const LARGEURS = [320, 360, 390, 430, 768, 899];

test.describe('Mise en page du téléphone @mobile', () => {
  for (const largeur of LARGEURS) {
    test(`à ${largeur} px : rien ne déborde ; barre du haut, réglages, bande et barre de lecture tiennent dans l'écran${largeur === 390 ? ' @critique' : ''}`, async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
      await page.setViewportSize({ width: largeur, height: 800 });
      await expect(caseN(page, 0, 3)).toBeVisible();
      expect(estMobile(page)).toBe(true);
      for (const l of [titre(page), boutonEnregistrer(page), parametres(page), compte(page), onglets(page), annuler(page), retablir(page), resume(page), boutonAffichage(page),
        boutonSequenceurHaut(page), bandeClavier(page), bandeGuitare(page), bandeFichier(page), barreLecture(page), boutonPlus(page), boutonAccord(page, 0), boutonAccord(page, 1)])
        await tientDansL_ecran(page, l);
      await tientDansL_ecran(page, caseN(page, 0, 3));
      expect(await defilementHorizontal(page)).toBe(0);
      // rien ne se recouvre dans la bande du bas
      const [k, g, f] = [await boite(bandeClavier(page)), await boite(bandeGuitare(page)), await boite(bandeFichier(page))];
      expect(g.x).toBeGreaterThanOrEqual(k.x + k.width - 1);
      expect(f.x).toBeGreaterThanOrEqual(g.x + g.width - 1);
      // ni dans la première rangée
      const [t, e, p, c] = [await boite(titre(page)), await boite(boutonEnregistrer(page)), await boite(parametres(page)), await boite(compte(page))];
      expect(e.x).toBeGreaterThanOrEqual(t.x + t.width - 1);
      expect(p.x).toBeGreaterThanOrEqual(e.x + e.width - 1);
      expect(c.x).toBeGreaterThanOrEqual(p.x + p.width - 1);
      expect(t.width).toBeGreaterThan(60);   // le nom du morceau garde de la place
    });
  }

  test('en paysage (844 × 390) : la page défile, la barre du haut et la barre de lecture restent à l\'écran, sans débordement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(caseN(page, 0, 0)).toBeVisible();
    expect(estMobile(page)).toBe(true);
    for (const l of [titre(page), onglets(page), barreLecture(page), boutonPlus(page)]) await tientDansL_ecran(page, l);
    expect(await defilementHorizontal(page)).toBe(0);
    // au moins une case est visible entre les deux barres
    const [o, b, c] = [await boite(onglets(page)), await boite(barreLecture(page)), await boite(caseN(page, 0, 0))];
    expect(c.y).toBeGreaterThanOrEqual(o.y + o.height - 1);
    expect(c.y).toBeLessThan(b.y);
    // la barre de lecture reste utilisable : « … » ouvre le panneau Lecture, qui tient dans la hauteur
    await boutonPlus(page).tap();
    const panneau = page.getByRole('dialog', { name: 'Lecture', exact: true });
    await expect(panneau).toBeVisible();
    const pb = await boite(panneau);
    expect(pb.x).toBeGreaterThanOrEqual(-1);
    expect(pb.x + pb.width).toBeLessThanOrEqual(845);
  });

  test('le seuil de 900 px : à 899 px la mise en page téléphone, à 900 px celle de l\'ordinateur, et on revient @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await page.setViewportSize({ width: 899, height: 800 });
    await expect(boutonAffichage(page)).toBeVisible();
    await expect(boutonSequenceurHaut(page)).toBeVisible();
    await expect(boutonPlus(page)).toBeVisible();
    await expect(bandeClavier(page)).toBeVisible();

    await page.setViewportSize({ width: 900, height: 800 });
    await expect(boutonAffichage(page)).toBeHidden();
    await expect(boutonSequenceurHaut(page)).toBeHidden();
    await expect(boutonPlus(page)).toBeHidden();
    await expect(page.locator('#bl-tempo')).toBeVisible();   // le bouton « 120 BPM » de la barre de lecture de l'ordinateur
    expect(await defilementHorizontal(page)).toBe(0);

    await page.setViewportSize({ width: 899, height: 800 });
    await expect(boutonAffichage(page)).toBeVisible();
    await expect(boutonPlus(page)).toBeVisible();
    await expect(page.locator('#bl-tempo')).toBeHidden();
    await expect(caseN(page, 0, 1)).toBeVisible();
    expect(await defilementHorizontal(page)).toBe(0);
  });

  test('ouvrir le panneau d\'ajout ne donne pas le focus à la saisie : le clavier du téléphone ne se lève pas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await boutonAccord(page, 0).tap();
    await expect(panneauAjout(page)).toBeVisible();
    await expect(saisieAjout(page)).toBeVisible();
    await expect(saisieAjout(page)).not.toBeFocused();
    // et la saisie se remplit quand le doigt la touche
    await saisieAjout(page).tap();
    await expect(saisieAjout(page)).toBeFocused();
  });
});

test.describe('L\'ordinateur n\'a rien de la mise en page du téléphone @ordinateur', () => {
  test('à l\'ordinateur : pas de bouton « Affichage », « Séquenceur » de rangée, « … » de lecture, « + Accord » d\'en-tête ni bande du bas @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    expect(estMobile(page)).toBe(false);
    await expect(caseN(page, 0, 0)).toBeVisible();
    for (const l of [boutonAffichage(page), boutonSequenceurHaut(page), boutonPlus(page), boutonAccord(page, 0)]) await expect(l).toBeHidden();
    await expect(page.locator('#bl-tempo')).toBeVisible();
    // Clavier / Guitare sont dans la barre de lecture, pas dans une bande fixe au-dessus d'elle
    await expect(barreLecture(page).getByRole('button', { name: 'Afficher le piano' })).toBeVisible();
    expect(await bandeClavier(page).evaluate(e => getComputedStyle(e.closest('.viz-bande') || e).position)).not.toBe('fixed');
    await expect(titre(page)).toBeVisible();
    await expect(onglets(page)).toBeVisible();
    expect(await defilementHorizontal(page)).toBe(0);
  });
});
