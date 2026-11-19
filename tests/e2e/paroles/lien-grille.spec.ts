// MODULE « paroles » — le lien avec la grille et la bibliothèque : la page des paroles se construit d'après les parties et les accords de la grille ;
// les paroles sont rangées par MORCEAU (clé `harmohub_lyrics_v1_id-<morceau>`).
// Les tests marqués P-05 et P-06 décrivent des bugs ouverts (tests/reports/bugs.md) : les paroles et les accords posés sont rattachés à la POSITION de la partie
// et de l'accord, pas à la partie ou à l'accord eux-mêmes ; ils sont corrigés depuis le 19/11 (P-05, P-06).
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  morceauParoles, DEUX_PARTIES, UNE_PARTIE, ouvrirParoles, retourGrille, cartes, carte, reserve, zoneTexte, nomsPastilles, ecrire, poserAccord,
  boutonArreter, attendreStockage, parolesStockees, appuyer, ongletParoles, repondreAuxConfirmations, selectionner, cliquerPlusAvant, saisirAjoutRapide, regionParoles, cadre,
} from './aide-paroles';
import { ouvrirMenuPartie } from '../grille/aide-grille';
import { bibliotheque, ouvrirMesMorceaux, ligne } from '../fichiers/aide-fichiers';

const PHRASE = 'Une ligne de texte assez longue';
const titreCarte = async (page: Page, n: number) => ((await carte(page, n).innerText()).split('\n')[0] || '').trim().toLowerCase();

async function actionPartie(page: Page, partie: number, entree: string) {
  const menu = await ouvrirMenuPartie(page, partie);
  await appuyer(page, menu.getByRole('menuitem', { name: entree }));
}

test.describe('La page des paroles suit la grille @paroles', () => {
  test('un accord ajouté dans la grille apparaît dans la réserve de la partie, qui compte une mesure de plus @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await cliquerPlusAvant(page, 0, 3);
    await saisirAjoutRapide(page, 'Dm');
    await ouvrirParoles(page);
    await expect(reserve(page, 0)).toHaveText(['C', 'Am', 'F', 'Dm', 'G']);
    await expect(carte(page, 0)).toContainText('5 mesures');
  });

  test('un accord supprimé de la grille disparaît de la réserve', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    repondreAuxConfirmations(page, true);
    await selectionner(page, 0, 3);
    await page.keyboard.press('Delete');
    await ouvrirParoles(page);
    await expect(reserve(page, 0)).toHaveText(['C', 'Am', 'F']);
    await expect(carte(page, 0)).toContainText('3 mesures');
  });

  test('une partie ajoutée à la grille devient une carte vide à la fin, les autres gardent leurs paroles @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Texte du couplet');
    await attendreStockage(page, s => s.sections[0].lyricsHtml, 'Texte du couplet');
    await retourGrille(page);
    await appuyer(page, page.locator('#add-section'));
    await ouvrirParoles(page);
    await expect(cartes(page)).toHaveCount(2);
    await expect(zoneTexte(page, 0)).toHaveText('Texte du couplet');
    await expect(zoneTexte(page, 1)).toHaveText('');
  });

  test('un accord ajouté APRÈS les accords posés ne change rien à ceux-ci @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'Am', 0, 0.3);
    await poserAccord(page, 'F', 0, 0.6);
    await appuyer(page, boutonArreter(page));
    await attendreStockage(page, s => s.sections[0].placements.length, 2);
    await retourGrille(page);
    await cliquerPlusAvant(page, 0, 3);
    await saisirAjoutRapide(page, 'Dm');
    await ouvrirParoles(page);
    expect(await nomsPastilles(page)).toEqual(['Am', 'F']);
  });

  test('un accord inséré AVANT les accords posés ne les renomme pas @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'Am', 0, 0.3);
    await poserAccord(page, 'F', 0, 0.6);
    await appuyer(page, boutonArreter(page));
    await attendreStockage(page, s => s.sections[0].placements.length, 2);
    await retourGrille(page);
    await cliquerPlusAvant(page, 0, 0);
    await saisirAjoutRapide(page, 'Dm');
    await ouvrirParoles(page);
    await expect(reserve(page, 0)).toHaveText(['Dm', 'C', 'Am', 'F', 'G']);
    expect(await nomsPastilles(page)).toEqual(['Am', 'F']);
  });

  test('supprimer de la grille un accord qui précède les accords posés ne les renomme pas', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(UNE_PARTIE));
    repondreAuxConfirmations(page, true);
    await ouvrirParoles(page);
    await ecrire(page, 0, PHRASE);
    await poserAccord(page, 'Am', 0, 0.3);
    await poserAccord(page, 'F', 0, 0.6);
    await appuyer(page, boutonArreter(page));
    await attendreStockage(page, s => s.sections[0].placements.length, 2);
    await retourGrille(page);
    await selectionner(page, 0, 0);   // supprime le C, avant les deux accords posés
    await page.keyboard.press('Delete');
    await ouvrirParoles(page);
    await expect(reserve(page, 0)).toHaveText(['Am', 'F', 'G']);
    expect(await nomsPastilles(page)).toEqual(['Am', 'F']);
  });
});

test.describe('Les paroles suivent leur partie @paroles', () => {
  // Deux parties « Couplet » et « Refrain » portent chacune leur texte ; on bouge les parties dans la grille et on regarde où vont les paroles.
  async function preparer(page: Page) {
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Texte du couplet');
    await ecrire(page, 1, 'Texte du refrain');
    await attendreStockage(page, s => s.sections.map(p => p.lyricsHtml), ['Texte du couplet', 'Texte du refrain']);
    await retourGrille(page);
  }

  test('« Monter » le refrain dans la grille : chaque texte reste sous sa partie @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await preparer(page);
    await actionPartie(page, 1, 'Monter');
    await ouvrirParoles(page);
    expect([await titreCarte(page, 0), await titreCarte(page, 1)].map(t => t.slice(0, 7))).toEqual(['refrain', 'couplet']);
    await expect(zoneTexte(page, 0)).toHaveText('Texte du refrain');
    await expect(zoneTexte(page, 1)).toHaveText('Texte du couplet');
  });

  test('supprimer le couplet dans la grille : le refrain garde SON texte', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    repondreAuxConfirmations(page, true);
    await preparer(page);
    await actionPartie(page, 0, 'Supprimer la partie');
    await ouvrirParoles(page);
    await expect(cartes(page)).toHaveCount(1);
    await expect(zoneTexte(page, 0)).toHaveText('Texte du refrain');
  });

  test('« Dupliquer » le couplet : le refrain garde SON texte', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await preparer(page);
    await actionPartie(page, 0, 'Dupliquer');
    await ouvrirParoles(page);
    await expect(cartes(page)).toHaveCount(3);
    await expect(zoneTexte(page, 0)).toHaveText('Texte du couplet');
    await expect(zoneTexte(page, 2)).toHaveText('Texte du refrain');
  });

  test('renommer une partie dans la grille change le titre de sa carte, sans toucher aux paroles', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauParoles(DEUX_PARTIES));
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Texte du couplet');
    await attendreStockage(page, s => s.sections[0].lyricsHtml, 'Texte du couplet');
    await retourGrille(page);
    await actionPartie(page, 0, 'Renommer');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Intro');
    await page.keyboard.press('Enter');
    await ouvrirParoles(page);
    await expect(carte(page, 0)).toContainText(/intro/i);
    await expect(zoneTexte(page, 0)).toHaveText('Texte du couplet');
  });
});

test.describe('Les paroles suivent le morceau @paroles', () => {
  const deuxMorceaux = () => bibliotheque([
    { id: 'alpha', nom: 'Alpha', accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] },
    { id: 'bravo', nom: 'Bravo', accords: [{ root: 'D', quality: 'min' }, { root: 'A', quality: 'min' }, { root: 'E', quality: '' }] },
  ], 'alpha');

  test('chaque morceau a ses paroles : ouvrir un autre morceau ne mélange rien, y revenir retrouve les siennes @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: deuxMorceaux() });
    await ouvrirParoles(page);
    await expect(reserve(page, 0)).toHaveText(['C', 'G']);
    await ecrire(page, 0, 'Paroles d\'Alpha');
    await attendreStockage(page, s => s.sections[0].lyricsHtml, 'Paroles d\'Alpha');
    await ouvrirMesMorceaux(page);
    await appuyer(page, ligne(page, 'Bravo').getByRole('button', { name: 'Ouvrir' }));
    // l'onglet Paroles reste ouvert : la page se recharge toute seule avec le nouveau morceau
    await expect(ongletParoles(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(reserve(page, 0)).toHaveText(['Dm', 'Am', 'E']);
    await expect(zoneTexte(page, 0)).toHaveText('');
    await ecrire(page, 0, 'Paroles de Bravo');
    await attendreStockage(page, s => [s.songName, s.sections[0].lyricsHtml], ['Bravo', 'Paroles de Bravo']);
    await ouvrirMesMorceaux(page);
    await appuyer(page, ligne(page, 'Alpha').getByRole('button', { name: 'Ouvrir' }));
    await expect(reserve(page, 0)).toHaveText(['C', 'G']);
    await expect(zoneTexte(page, 0)).toHaveText('Paroles d\'Alpha');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('harmohub_lyrics_v1_id-bravo')!).sections[0].lyricsHtml)).toBe('Paroles de Bravo');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('harmohub_lyrics_v1_id-alpha')!).sections[0].lyricsHtml)).toBe('Paroles d\'Alpha');
  });

  test('les paroles sont rangées sous le numéro du morceau, avec son nom', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: deuxMorceaux() });
    await ouvrirParoles(page);
    await ecrire(page, 0, 'Pour Alpha');
    await attendreStockage(page, s => [s.songName, s.sections[0].lyricsHtml], ['Alpha', 'Pour Alpha']);
    expect(await page.evaluate(() => localStorage.getItem('harmohub_lyrics_v1_id-bravo'))).toBeNull();
    expect((await parolesStockees(page))!.songName).toBe('Alpha');
    await expect(regionParoles(page)).toBeVisible();
    await expect(cadre(page).locator('.chord-chip')).toHaveCount(2);
  });
});
