// MODULE « structure » — supprimer une partie DANS LA GRILLE quand l'arrangement la cite (essai neutre du 25/11, SN-08). Avant : la confirmation ne
// parlait pas de la structure et les passages devenaient des lignes « Partie supprimée » sans nom (impossible de distinguer un Couplet d'un Pont).
import { test, expect } from '../support/fixtures';
import {
  morceauTroisParties, ouvrirStructure, retourGrille, lire, titresLignes, choisirAction, appuyer, ouvrirMenuPartie, repondreAuxConfirmations, lignes,
} from './aide-structure';

test.describe('Partie supprimée de la grille @structure', () => {
  test('la confirmation annonce les passages de la structure ; les lignes gardent le nom de la partie, barrées @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 0, /^Dupliquer/);                              // Couplet, Couplet, Refrain, Pont : l'arrangement existe
    await retourGrille(page);
    const messages = repondreAuxConfirmations(page);
    const menu = await ouvrirMenuPartie(page, 0);
    await appuyer(page, menu.getByRole('menuitem', { name: 'Supprimer la partie' }));
    await expect.poll(() => messages).toEqual(['Supprimer « Couplet » et ses 4 accord(s) ? Elle est jouée 2 fois dans la structure : ces passages seront barrés (annulable).']);
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Couplet', 'Refrain', 'Pont']);        // le nom est gardé
    const v = await lire(page);
    expect(v.lignes[0].mesures).toBe('supprimée de la grille');
    await expect(lignes(page).nth(0)).toHaveClass(/struct-orpheline/);
    await expect(lignes(page).nth(1)).toHaveClass(/struct-orpheline/);
    await expect(lignes(page).nth(2)).not.toHaveClass(/struct-orpheline/);
    expect(v.mesures).toBe('6 mesures');                                                         // seuls Refrain (4) et Pont (2) comptent
  });

  test('sans arrangement (structure déduite), la confirmation reste celle d\'avant', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    const messages = repondreAuxConfirmations(page);
    const menu = await ouvrirMenuPartie(page, 0);
    await appuyer(page, menu.getByRole('menuitem', { name: 'Supprimer la partie' }));
    await expect.poll(() => messages).toEqual(['Supprimer « Couplet » et ses 4 accord(s) ?']);
  });

  test('un seul passage : la confirmation le dit au singulier ; Ctrl+Z ramène la partie ET sa ligne normale', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await choisirAction(page, 2, /^Dupliquer/);                              // Pont ×2 lignes ; Couplet n'en a qu'une
    await retourGrille(page);
    const messages = repondreAuxConfirmations(page);
    const menu = await ouvrirMenuPartie(page, 0);
    await appuyer(page, menu.getByRole('menuitem', { name: 'Supprimer la partie' }));
    await expect.poll(() => messages).toEqual(['Supprimer « Couplet » et ses 4 accord(s) ? Elle est jouée 1 fois dans la structure : ce passage sera barré (annulable).']);
    await page.keyboard.press('Control+z');
    await ouvrirStructure(page);
    expect(await titresLignes(page)).toEqual(['Couplet', 'Refrain', 'Pont', 'Pont']);
    await expect(lignes(page).nth(0)).not.toHaveClass(/struct-orpheline/);
  });
});
