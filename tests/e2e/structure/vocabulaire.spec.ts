// MODULE « structure » — les MOTS (essai neutre du 25/11, SN-12) : la somme compte des « passages » (les lignes de la liste, une partie jouée trois fois en fait trois), pas des
// « parties » (celles de la grille : une seule pour ces trois passages) ; et un morceau pas encore nommé s'appelle « Nouveau morceau » sur la feuille comme à l'écran.
import { test, expect } from '../support/fixtures';
import { morceauTroisParties, ouvrirStructure, lire, choisirAction, ouvrirApercu, feuille, estMobile } from './aide-structure';

test.describe('Vocabulaire de la structure @structure', () => {
  test('la somme compte des passages, pas des parties de la grille @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    expect((await lire(page)).parties).toBe('3 passage(s)');
    await choisirAction(page, 0, /^Dupliquer/);
    await choisirAction(page, 0, /^Dupliquer/);
    expect((await lire(page)).parties).toBe('5 passage(s)');             // la grille, elle, n'a toujours que trois parties
    expect(await page.locator('#progression-sections .prog-section').count()).toBe(3);
  });

  test('la feuille d\'un morceau pas encore nommé porte « Nouveau morceau », pas « Sans titre »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({});
    test.skip(estMobile(page), 'la saisie d\'accord « à la fin » est celle de l\'ordinateur');
    const champ = page.getByRole('textbox', { name: 'Ajouter un accord à la fin de cette partie' }).first();
    await champ.fill('C'); await champ.press('Enter');
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await expect(feuille(page).locator('.sf-entete')).toContainText('Nouveau morceau');
    await expect(feuille(page).locator('.sf-entete')).not.toContainText('Sans titre');
  });

  test('la feuille d\'un morceau nommé porte son nom', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties());
    await ouvrirStructure(page);
    await ouvrirApercu(page);
    await expect(feuille(page).locator('.sf-entete')).toContainText('Démo');
  });
});
