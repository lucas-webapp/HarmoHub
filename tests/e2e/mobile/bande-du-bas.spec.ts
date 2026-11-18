// MODULE « mobile » — la bande fixe du bas (Clavier / Guitare à gauche, Fichier à droite, au-dessus de la barre de lecture) et le bloc « Voir » du panneau « Lecture ».
// Le panneau « Lecture » (tempo, vitesse, métronome) et le menu « Fichier » sont éprouvés par les modules lecture et fichiers ; le doigté des diagrammes est le futur module diagrammes.
import { test, expect } from '../support/fixtures';
import {
  DEUX_PARTIES, caseN, bandeClavier, bandeGuitare, bandeFichier, barreLecture, boutonPlus, panneauLecture, voirClavier, voirGuitare, voirSequenceur, boite, fenetre,
  boutonAccord, panneauAjout, ouvrirFenetre, tientDansL_ecran, defiler, resume,
} from './aide-mobile';

const piano = (page: any) => page.locator('#piano-viz');
const guitare = (page: any) => page.locator('#guitar-viz-wrap');
const enTete = (page: any) => page.locator('.chord-header-row');   // nom de l'accord affiché sous la grille, puis ses notes (« Am » / A C E)

test.describe('Bande du bas et bloc « Voir » au téléphone @mobile', () => {
  test('Clavier et Guitare à gauche, Fichier à droite, collés au-dessus de la barre de lecture, sans rien recouvrir @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    for (const l of [bandeClavier(page), bandeGuitare(page), bandeFichier(page)]) { await expect(l).toBeVisible(); await tientDansL_ecran(page, l); }
    const [k, g, f, b] = [await boite(bandeClavier(page)), await boite(bandeGuitare(page)), await boite(bandeFichier(page)), await boite(barreLecture(page))];
    expect(k.x).toBeLessThan(g.x);
    expect(g.x + g.width).toBeLessThan(f.x);
    expect(k.x).toBeLessThanOrEqual(16);                                     // marge de 12 px à gauche
    expect(page.viewportSize()!.width - (f.x + f.width)).toBeLessThanOrEqual(16);   // et à droite
    for (const x of [k, g, f]) {
      expect(x.y + x.height).toBeLessThanOrEqual(b.y);                       // au-dessus de la barre de lecture
      expect(b.y - (x.y + x.height)).toBeLessThanOrEqual(16);               // et tout contre elle
      expect(Math.abs(x.y - k.y)).toBeLessThanOrEqual(2);                    // sur une même ligne
    }
    await expect(bandeClavier(page)).toHaveAccessibleName('Afficher le piano');
    await expect(bandeGuitare(page)).toHaveAccessibleName('Afficher la guitare');
    await expect(bandeFichier(page)).toHaveAccessibleName('Importer / exporter');
    expect(garde.bloquees).toEqual([]);
  });

  test('la bande reste à sa place quand la page défile', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    const avant = await boite(bandeClavier(page)), fichier = await boite(bandeFichier(page));
    await defiler(page, 300);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(100);
    const apres = await boite(bandeClavier(page));
    expect(apres.y).toBeCloseTo(avant.y, 0);
    expect((await boite(bandeFichier(page))).y).toBeCloseTo(fichier.y, 0);
    await expect(bandeFichier(page)).toBeVisible();
  });

  test('Clavier et Guitare montrent ou cachent leur diagramme, et le choix survit à un rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    // au départ : le piano est affiché, la guitare non
    await expect(bandeClavier(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(bandeGuitare(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(piano(page)).toBeVisible();
    await expect(guitare(page)).toBeHidden();

    await bandeGuitare(page).tap();
    await expect(bandeGuitare(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(guitare(page)).toBeVisible();
    await expect(piano(page)).toBeVisible();

    await bandeClavier(page).tap();
    await expect(bandeClavier(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(piano(page)).toBeHidden();
    await expect(guitare(page)).toBeVisible();

    await page.reload();
    await expect(caseN(page, 0, 0)).toBeVisible();
    await expect(bandeClavier(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(bandeGuitare(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(piano(page)).toBeHidden();
    await expect(guitare(page)).toBeVisible();

    await bandeGuitare(page).tap();
    await expect(guitare(page)).toBeHidden();
    await expect(piano(page)).toBeHidden();   // plus aucun diagramme
  });

  test('le diagramme suit l\'accord touché : nom et notes @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await expect(enTete(page)).toHaveText(/^\s*C\s*C\s*E\s*G\s*$/);
    await caseN(page, 0, 1).tap();
    await expect(enTete(page)).toHaveText(/^\s*Am\s*A\s*C\s*E\s*$/);
    await caseN(page, 0, 2).tap();
    await expect(enTete(page)).toHaveText(/^\s*F\s*F\s*A\s*C\s*$/);
    await caseN(page, 1, 0).tap();
    await expect(enTete(page)).toHaveText(/^\s*F\s*F\s*A\s*C\s*$/);
    await caseN(page, 0, 3).tap();
    await expect(enTete(page)).toHaveText(/^\s*G\s*G\s*B\s*D\s*$/);
  });

  test('la bande se cache sous la feuille d\'accord et sous le panneau d\'ajout, et revient après @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await expect(bandeClavier(page)).toBeVisible();

    await boutonAccord(page, 1).tap();
    await expect(panneauAjout(page)).toBeVisible();
    await expect(bandeClavier(page)).toBeHidden();
    await expect(bandeFichier(page)).toBeHidden();
    await panneauAjout(page).getByRole('button', { name: 'Fermer' }).tap();
    await expect(panneauAjout(page)).toBeHidden();
    await expect(bandeClavier(page)).toBeVisible();
    await expect(bandeFichier(page)).toBeVisible();

    await ouvrirFenetre(page, 0, 1);
    await expect(bandeClavier(page)).toBeHidden();
    await expect(bandeFichier(page)).toBeHidden();
    await fenetre(page).getByRole('button', { name: 'Fermer' }).tap();
    await expect(fenetre(page)).toBeHidden();
    await expect(bandeClavier(page)).toBeVisible();
    await expect(bandeFichier(page)).toBeVisible();
  });

  test('le bloc « Voir » du panneau Lecture reflète et commande les mêmes diagrammes que la bande @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await boutonPlus(page).tap();
    await expect(panneauLecture(page)).toBeVisible();
    await expect(voirClavier(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(voirGuitare(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(voirSequenceur(page)).toBeVisible();
    await tientDansL_ecran(page, voirGuitare(page));

    // choisir un diagramme referme le panneau et amène la page sur lui
    await voirGuitare(page).tap();
    await expect(panneauLecture(page)).toBeHidden();
    await expect(bandeGuitare(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(guitare(page)).toBeVisible();
    await expect(guitare(page)).toBeInViewport();

    await boutonPlus(page).tap();
    await expect(voirGuitare(page)).toHaveAttribute('aria-pressed', 'true');
    await voirClavier(page).tap();
    await expect(panneauLecture(page)).toBeHidden();
    await expect(bandeClavier(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(piano(page)).toBeHidden();

    // et dans l'autre sens : un bouton de la bande se retrouve dans le panneau
    await bandeClavier(page).tap();
    await expect(piano(page)).toBeVisible();
    await boutonPlus(page).tap();
    await expect(voirClavier(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('« Séquenceur » du panneau Lecture referme le panneau et ouvre la feuille d\'accord sur le rythme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await caseN(page, 0, 2).tap();
    await boutonPlus(page).tap();
    await voirSequenceur(page).tap();
    await expect(fenetre(page)).toBeVisible();
    await expect(fenetre(page)).toHaveAccessibleName('Accord F');
    await expect(fenetre(page).getByRole('button', { name: 'Rythme', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(panneauLecture(page)).toBeHidden();
  });

  test('« Fichier » ouvre le menu d\'import et d\'export, dans l\'écran', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: DEUX_PARTIES });
    await bandeFichier(page).tap();
    await expect(bandeFichier(page)).toHaveAttribute('aria-expanded', 'true');
    const exportPdf = page.getByRole('button', { name: /Exporter en PDF/ });
    await expect(exportPdf).toBeVisible();
    await tientDansL_ecran(page, exportPdf);
    await expect(page.getByRole('button', { name: /Importer un MIDI/ })).toBeVisible();
  });
});
