// MODULE « paroles » — par partie : nombre de répétitions « × N » ; panneau « Options » : taille du texte, « Enchaîner les accords », « Versions précédentes ».
// Le × N est « purement indicatif » (infobulle de l'appli) : il se retient avec les paroles mais ne change ni la grille ni la lecture.
import { test, expect } from '../support/fixtures';
import {
  morceauParoles, focaliser, DEUX_PARTIES, UNE_PARTIE, ouvrirParoles, zoneTexte, carte, pastilles, repMoins, repPlus, ecrire, poserAccord, boutonArreter, boutonOptions,
  panneauOptions, curseurTaille, cadre, rectLigne, parolesStockees, attendreStockage, appuyer,
} from './aide-paroles';

const PHRASE = 'Une ligne de texte assez longue';
const valeurRep = (page: import('@playwright/test').Page, partie = 0) => carte(page, partie).getByText(/^× \d+$/);
const taillePolice = (page: import('@playwright/test').Page) => zoneTexte(page, 0).evaluate(e => parseFloat(getComputedStyle(e).fontSize));

test.describe('Répétitions « × N » @paroles', () => {
  test('« × 1 » au départ avec « − » inactif ; « + » monte, « − » redescend, jamais sous 1 @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await expect(valeurRep(page)).toHaveText('× 1');
    await expect(repMoins(page)).toBeDisabled();
    await appuyer(page, repPlus(page));
    await appuyer(page, repPlus(page));
    await appuyer(page, repPlus(page));
    await expect(valeurRep(page)).toHaveText('× 4');
    await expect(repMoins(page)).toBeEnabled();
    await appuyer(page, repMoins(page));
    await expect(valeurRep(page)).toHaveText('× 3');
    await appuyer(page, repMoins(page));
    await appuyer(page, repMoins(page));
    await expect(valeurRep(page)).toHaveText('× 1');
    await expect(repMoins(page)).toBeDisabled();
    await attendreStockage(page, s => s.sections[0].repeatCount, 1);
  });

  test('chaque partie a son propre ×N, enregistré avec les paroles @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    await appuyer(page, repPlus(page, 1));
    await appuyer(page, repPlus(page, 1));
    await expect(valeurRep(page, 1)).toHaveText('× 3');
    await expect(valeurRep(page, 0)).toHaveText('× 1');
    await attendreStockage(page, s => s.sections.map(p => p.repeatCount), [1, 3]);
  });

  test('le ×N d\'une partie est retrouvé tel quel après rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    await appuyer(page, repPlus(page, 1));
    await appuyer(page, repPlus(page, 1));
    await attendreStockage(page, s => s.sections.map(p => p.repeatCount), [1, 3]);
    await page.reload();
    await ouvrirParoles(page);
    await expect(valeurRep(page, 1)).toHaveText('× 3');
    await expect(valeurRep(page, 0)).toHaveText('× 1');
  });

  test('le ×N est une indication : il ne touche ni aux paroles ni aux accords posés', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'Am', 0, 0.4);
    await appuyer(page, boutonArreter(page));
    await appuyer(page, repPlus(page));
    await expect(valeurRep(page)).toHaveText('× 2');
    await expect(zoneTexte(page, 0)).toHaveText(PHRASE);
    await expect(pastilles(page)).toHaveCount(1);
  });
});

test.describe('Options @paroles', () => {
  test('le panneau est replié au départ, « Options » l\'ouvre et le referme', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await expect(panneauOptions(page)).toBeHidden();
    await appuyer(page, boutonOptions(page));
    await expect(panneauOptions(page)).toBeVisible();
    await expect(curseurTaille(page)).toBeVisible();
    await appuyer(page, boutonOptions(page));
    await expect(panneauOptions(page)).toBeHidden();
  });

  test('« Taille du texte » : 100 % au départ, le curseur agrandit le texte et l\'affiche en % @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Un peu de texte');
    const avant = await taillePolice(page);
    await appuyer(page, boutonOptions(page));
    await expect(curseurTaille(page)).toHaveAttribute('min', '0.8');
    await expect(curseurTaille(page)).toHaveAttribute('max', '1.6');
    await expect(curseurTaille(page)).toHaveValue('1');
    await expect(panneauOptions(page)).toContainText('100%');
    await curseurTaille(page).fill('1.5');
    await expect(panneauOptions(page)).toContainText('150%');
    expect(await taillePolice(page)).toBeCloseTo(avant * 1.5, 0);
    await curseurTaille(page).fill('0.8');
    await expect(panneauOptions(page)).toContainText('80%');
    expect(await taillePolice(page)).toBeCloseTo(avant * 0.8, 0);
  });

  test('la taille du texte est retenue après rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await appuyer(page, boutonOptions(page));
    await curseurTaille(page).fill('1.5');
    const grande = await taillePolice(page);
    await page.reload();
    await ouvrirParoles(page);
    expect(await taillePolice(page)).toBeCloseTo(grande, 1);
    await appuyer(page, boutonOptions(page));
    await expect(curseurTaille(page)).toHaveValue('1.5');
    await expect(panneauOptions(page)).toContainText('150%');
  });

  test('un accord posé reste au-dessus de son caractère quand on change la taille du texte @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'C', 0, 0.5);
    await appuyer(page, boutonArreter(page));
    await appuyer(page, boutonOptions(page));
    await curseurTaille(page).fill('1.4');
    // le caractère visé est au milieu du texte, quelle que soit la taille : le centre de la pastille suit
    await expect.poll(async () => {
      const l = await rectLigne(page, 0, 0), p = (await pastilles(page).first().boundingBox())!;
      return Math.abs(p.x + p.width / 2 - (l.x + l.width * 0.5));
    }).toBeLessThanOrEqual(14);
    const l = await rectLigne(page, 0, 0), p = (await pastilles(page).first().boundingBox())!;
    expect(p.y + p.height).toBeLessThanOrEqual(l.y + 2);   // et toujours au-dessus du texte
  });

  test('le texte d\'aide du panneau a le même style partout (taille et couleur) @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await appuyer(page, boutonOptions(page));
    const styles = await cadre(page).locator('#options-panel .option-help').evaluateAll(es => es.map(e => { const c = getComputedStyle(e); return c.fontSize + ' ' + c.color; }));
    expect(styles.length).toBe(2);
    expect(styles[1]).toBe(styles[0]);
  });
});

test.describe('Versions précédentes des paroles @paroles', () => {
  const versions = (page: import('@playwright/test').Page) => cadre(page).locator('#versions-paroles-liste .version-carte');

  test('sans modification d\'un texte déjà enregistré, aucune version n\'est proposée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await appuyer(page, boutonOptions(page));
    await expect(panneauOptions(page)).toContainText('Aucune version précédente pour l\'instant');
    await expect(versions(page)).toHaveCount(0);
  });

  test('modifier des paroles déjà enregistrées garde l\'ancien texte comme version ; « Restaurer » le remet en place @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Premier jet');
    await attendreStockage(page, s => s.sections[0].lyricsHtml, 'Premier jet');
    await page.reload();
    await ouvrirParoles(page);
    await focaliser(page, 0);
    await page.keyboard.press('End');
    await page.keyboard.type(' modifié');
    await expect(zoneTexte(page, 0)).toHaveText('Premier jet modifié');
    await attendreStockage(page, s => s.sections[0].lyricsHtml, 'Premier jet modifié');
    await appuyer(page, boutonOptions(page));
    await expect(versions(page)).toHaveCount(1);
    await expect(versions(page).first()).toContainText('Automatique');
    await expect(versions(page).first()).toContainText('« Premier jet »');
    await expect(versions(page).first()).toContainText('2 mots');
    await appuyer(page, versions(page).first().getByRole('button', { name: 'Restaurer' }));
    await expect(zoneTexte(page, 0)).toHaveText('Premier jet');
    await attendreStockage(page, s => s.sections[0].lyricsHtml, 'Premier jet');
    // les paroles qu'on vient de quitter sont gardées à leur tour : rien n'est perdu
    await expect(versions(page)).toHaveCount(2);
    await expect(cadre(page).locator('#versions-paroles-liste')).toContainText('« Premier jet modifié »');
  });

  test('la version restaurée est retrouvée après rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Premier jet');
    await attendreStockage(page, s => s.sections[0].lyricsHtml, 'Premier jet');
    await page.reload();
    await ouvrirParoles(page);
    await focaliser(page, 0);
    await page.keyboard.press('End');
    await page.keyboard.type(' modifié');
    await attendreStockage(page, s => s.sections[0].lyricsHtml, 'Premier jet modifié');
    await appuyer(page, boutonOptions(page));
    await appuyer(page, versions(page).first().getByRole('button', { name: 'Restaurer' }));
    await attendreStockage(page, s => s.sections[0].lyricsHtml, 'Premier jet');
    await page.reload();
    await ouvrirParoles(page);
    await expect(zoneTexte(page, 0)).toHaveText('Premier jet');
    expect((await parolesStockees(page))!.sections).toHaveLength(1);
  });
});
