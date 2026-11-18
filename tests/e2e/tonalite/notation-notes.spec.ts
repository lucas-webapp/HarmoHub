// MODULE « tonalite » — notation dans le séquenceur (étiquettes des lignes de notes) : elles suivent la tonalité comme les noms d'accords. Ordinateur.
// (Les notes ajoutées — « Eb3 » tapé devient « D#3 » en do — sont couvertes par le module « sequenceur ».)
import { test, expect } from '../support/fixtures';
import { choisir, fermerFenetre, libelle } from './aide-tonalite';
import { ouvrirSurAccord, grille } from '../sequenceur/aide-sequenceur';

const etiquettes = (page: import('@playwright/test').Page) => grille(page).locator('.sq-etiq');

test.describe('Notation dans le séquenceur @tonalite @ordinateur', () => {
  test('les lignes de notes d\'un accord de si bémol s\'écrivent B♭ en do et A# en si majeur', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: [{ root: 'A#', quality: '' }, { root: 'C', quality: '' }] });
    await ouvrirSurAccord(page, 0);
    await expect(etiquettes(page).filter({ hasText: /B♭3/ })).toHaveCount(1);
    await expect(etiquettes(page).filter({ hasText: 'A#' })).toHaveCount(0);
    await choisir(page, 'B');
    await fermerFenetre(page);
    await expect.poll(() => libelle(page)).toBe('B majeur');
    await expect(etiquettes(page).filter({ hasText: /A#3/ })).toHaveCount(1);
    await expect(etiquettes(page).filter({ hasText: 'B♭' })).toHaveCount(0);
    expect(garde.bloquees).toEqual([]);
  });
});
