// MODULE « fichiers » — la liste « Mes morceaux » et le menu du nom : ouvrir, renommer, dupliquer, supprimer (avec confirmation), dossiers.
// Mêmes gestes à l'ordinateur et au téléphone. La bibliothèque de départ est posée dans le stockage local.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  bibliotheque, morceauxStockes, morceauCourantId, titre, toast, ouvrirMenuMorceau, choisirDansMenuMorceau, menuMorceau, ouvrirMesMorceaux,
  fenetreMorceaux, ligne, groupe, repondreAuxBoitesNatives, alerteNonEnregistre, modifierLeMorceau, noms,
} from './aide-fichiers';

const TROIS = [
  { id: 'a', nom: 'Alpha', accords: [{ root: 'C', quality: '' }, { root: 'G', quality: '' }] },
  { id: 'b', nom: 'Bravo', accords: [{ root: 'D', quality: 'min' }, { root: 'A', quality: '' }, { root: 'F', quality: '' }] },
  { id: 'c', nom: 'Charlie', accords: [{ root: 'E', quality: 'min' }] },
];
const ouvrirAvecTrois = async (ouvrirAppli: (o?: any) => Promise<Page>) => ouvrirAppli({ reglages: bibliotheque(TROIS, 'a') });

test.describe('Liste « Mes morceaux » @fichiers', () => {
  test('la fenêtre liste chaque morceau avec son nombre d\'accords, marque l\'ouvert et se ferme (croix, Échap) @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    const f = await ouvrirMesMorceaux(page);
    await expect(f.getByRole('heading', { name: 'Mes morceaux' })).toBeVisible();
    await expect(f.locator('.file-row')).toHaveCount(3);
    await expect(ligne(page, 'Alpha')).toContainText('2 accord(s)');
    await expect(ligne(page, 'Bravo')).toContainText('3 accord(s)');
    await expect(ligne(page, 'Charlie')).toContainText('1 accord(s)');
    await expect(ligne(page, 'Alpha')).toContainText('ouvert');
    await expect(ligne(page, 'Bravo')).not.toContainText('ouvert');
    await expect(groupe(page, 'Sans dossier')).toContainText('(3)');
    await f.getByRole('button', { name: 'Fermer' }).click();
    await expect(f).toBeHidden();
    await ouvrirMesMorceaux(page);
    await page.keyboard.press('Escape');
    await expect(fenetreMorceaux(page)).toBeHidden();
    expect(garde.bloquees).toEqual([]);
  });

  test('une bibliothèque vide le dit et propose d\'enregistrer', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli();
    await ouvrirMesMorceaux(page);
    await expect(fenetreMorceaux(page)).toContainText('Aucun morceau enregistré pour l\'instant');
    await expect(fenetreMorceaux(page).locator('.file-row')).toHaveCount(0);
  });

  test('« Ouvrir » charge le morceau choisi (titre, accords), referme la fenêtre et marque le courant @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    await ouvrirMesMorceaux(page);
    await ligne(page, 'Bravo').getByRole('button', { name: 'Ouvrir' }).click();
    await expect(fenetreMorceaux(page)).toBeHidden();
    await expect(titre(page)).toHaveText('Bravo');
    expect(await noms(page)).toEqual(['Dm', 'A', 'F']);
    expect(await morceauCourantId(page)).toBe('b');
    await ouvrirMesMorceaux(page);
    await expect(ligne(page, 'Bravo')).toContainText('ouvert');
    await expect(ligne(page, 'Alpha')).not.toContainText('ouvert');
  });

  test('ouvrir depuis la liste avec des modifications demande d\'abord ; « Annuler » laisse le morceau et ses modifications en place @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    await modifierLeMorceau(page, 'Refrain');
    await ouvrirMesMorceaux(page);
    await ligne(page, 'Charlie').getByRole('button', { name: 'Ouvrir' }).click();
    await expect(alerteNonEnregistre(page)).toBeVisible();
    await alerteNonEnregistre(page).getByRole('button', { name: 'Annuler' }).click();
    await expect(alerteNonEnregistre(page)).toBeHidden();
    await expect(titre(page)).toHaveText('Alpha');
    expect(await morceauCourantId(page)).toBe('a');
  });

  test('un morceau ouvert depuis le menu du nom remplace la grille', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    await ouvrirMenuMorceau(page);
    await menuMorceau(page).getByRole('menuitemradio', { name: /Charlie/ }).click();
    await expect(titre(page)).toHaveText('Charlie');
    expect(await noms(page)).toEqual(['Em']);
  });

  test('« Renommer » dans la liste : le nouveau nom est gardé partout (liste, titre, stockage) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    await ouvrirMesMorceaux(page);
    await ligne(page, 'Bravo').getByRole('button', { name: 'Renommer' }).click();
    const champ = fenetreMorceaux(page).locator('.file-row input');
    await expect(champ).toHaveValue('Bravo');
    await champ.fill('Bravo bis');
    await champ.press('Enter');
    await expect(ligne(page, 'Bravo bis')).toBeVisible();
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo bis', 'Charlie']);
    await expect(titre(page)).toHaveText('Alpha');   // le morceau ouvert n'a pas changé
  });

  test('« Renommer » le morceau ouvert depuis la liste change aussi le titre du haut', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    await ouvrirMesMorceaux(page);
    await ligne(page, 'Alpha').getByRole('button', { name: 'Renommer' }).click();
    await fenetreMorceaux(page).locator('.file-row input').fill('Alpha renommé');
    await fenetreMorceaux(page).locator('.file-row input').press('Enter');
    await expect(titre(page)).toHaveText('Alpha renommé');
  });

  test('« Renommer » du menu du nom : saisie sur place, Entrée valide ; le nom vide est refusé ; Échap abandonne @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    await choisirDansMenuMorceau(page, 'Renommer');
    const champ = page.locator('.tb-titre-saisie');
    await expect(champ).toBeFocused();
    await expect(champ).toHaveValue('Alpha');
    await champ.fill('   ');
    await champ.press('Enter');
    await expect(titre(page)).toHaveText('Alpha');   // un nom vide ne remplace pas le nom
    await choisirDansMenuMorceau(page, 'Renommer');
    await page.locator('.tb-titre-saisie').fill('Zzz');
    await page.locator('.tb-titre-saisie').press('Escape');
    await expect(titre(page)).toHaveText('Alpha');
    await choisirDansMenuMorceau(page, 'Renommer');
    await page.locator('.tb-titre-saisie').fill('Nouveau nom');
    await page.locator('.tb-titre-saisie').press('Enter');
    await expect(titre(page)).toHaveText('Nouveau nom');
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Nouveau nom', 'Bravo', 'Charlie']);
  });

  test('double-clic sur le nom : renommer sur place @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    await titre(page).dblclick();
    await expect(page.locator('.tb-titre-saisie')).toBeFocused();
    await page.locator('.tb-titre-saisie').fill('Par double-clic');
    await page.locator('.tb-titre-saisie').press('Enter');
    await expect(titre(page)).toHaveText('Par double-clic');
    expect((await morceauxStockes(page))[0].name).toBe('Par double-clic');
  });

  test('« Dupliquer » ajoute une copie « (2) », puis « (3) », sans quitter le morceau ouvert @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    await choisirDansMenuMorceau(page, 'Dupliquer');
    await expect(toast(page)).toContainText('« Alpha (2) » ajouté à Mes morceaux');
    await choisirDansMenuMorceau(page, 'Dupliquer');
    await expect(toast(page)).toContainText('« Alpha (3) » ajouté à Mes morceaux');
    await expect(titre(page)).toHaveText('Alpha');
    const tous = await morceauxStockes(page);
    expect(tous.map(m => m.name)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Alpha (2)', 'Alpha (3)']);
    const copie = tous.find(m => m.name === 'Alpha (2)')!;
    expect(copie.accords).toEqual(['C', 'G']);
    expect(copie.id).not.toBe('a');
    expect(await morceauCourantId(page)).toBe('a');
  });

  test('« Supprimer » demande confirmation (boîte native) ; refuser garde le morceau @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    const messages = repondreAuxBoitesNatives(page, false);
    await ouvrirMesMorceaux(page);
    await ligne(page, 'Charlie').getByRole('button', { name: 'Supprimer' }).click();
    await expect.poll(() => messages.length).toBe(1);
    expect(messages[0]).toContain('Supprimer « Charlie » ?');
    await expect(ligne(page, 'Charlie')).toBeVisible();
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  test('« Supprimer » (confirmé) retire un autre morceau ; Ctrl+Z le rend @critique @ordinateur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    repondreAuxBoitesNatives(page, true);
    await ouvrirMesMorceaux(page);
    await ligne(page, 'Charlie').getByRole('button', { name: 'Supprimer' }).click();
    await expect(ligne(page, 'Charlie')).toHaveCount(0);
    await expect(groupe(page, 'Sans dossier')).toContainText('(2)');
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo']);
    expect(await morceauCourantId(page)).toBe('a');
    await page.keyboard.press('Control+z');
    await expect(toast(page)).toContainText('Annulé');
    expect((await morceauxStockes(page)).map(m => m.name).sort()).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  test('« Supprimer » le morceau ouvert : il quitte la liste et le titre redevient « Nouveau morceau » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    repondreAuxBoitesNatives(page, true);
    await ouvrirMesMorceaux(page);
    await ligne(page, 'Alpha').getByRole('button', { name: 'Supprimer' }).click();
    await expect(ligne(page, 'Alpha')).toHaveCount(0);
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Bravo', 'Charlie']);
    expect(await morceauCourantId(page)).toBeNull();
    await expect(fenetreMorceaux(page).getByRole('button', { name: 'Fermer' })).toBeVisible();
    await fenetreMorceaux(page).getByRole('button', { name: 'Fermer' }).click();
    await expect(titre(page)).toHaveText('Nouveau morceau');
  });

  test('F-02 : supprimer le morceau ouvert vide aussi la grille', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    repondreAuxBoitesNatives(page, true);
    await ouvrirMesMorceaux(page);
    await ligne(page, 'Alpha').getByRole('button', { name: 'Supprimer' }).click();
    await expect(ligne(page, 'Alpha')).toHaveCount(0);
    await fenetreMorceaux(page).getByRole('button', { name: 'Fermer' }).click();
    await expect(titre(page)).toHaveText('Nouveau morceau');
    expect(await noms(page)).toEqual([]);   // le titre dit « Nouveau morceau » : la grille ne devrait plus montrer C et G
  });
});

test.describe('Dossiers de la liste @fichiers', () => {
  test('« Nouveau dossier » crée un dossier vide, et un morceau s\'y déplace puis en sort @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    await ouvrirMesMorceaux(page);
    await fenetreMorceaux(page).getByRole('button', { name: 'Nouveau dossier' }).click();
    await page.locator('#new-folder-input').fill('Jazz');
    await page.locator('#new-folder-input').press('Enter');
    await expect(groupe(page, 'Jazz')).toContainText('Dossier vide');
    await ligne(page, 'Bravo').getByRole('combobox', { name: 'Déplacer vers un dossier' }).selectOption({ label: 'Jazz' });
    await expect(groupe(page, 'Jazz')).toContainText('(1)');
    await expect(groupe(page, 'Jazz').locator('.file-row')).toContainText('Bravo');
    await expect(groupe(page, 'Sans dossier')).toContainText('(2)');
    expect((await morceauxStockes(page)).find(m => m.id === 'b')!.folder).toBe('Jazz');
    await ligne(page, 'Bravo').getByRole('combobox', { name: 'Déplacer vers un dossier' }).selectOption({ label: 'Sans dossier' });
    await expect(groupe(page, 'Sans dossier')).toContainText('(3)');
    expect((await morceauxStockes(page)).find(m => m.id === 'b')!.folder).toBeNull();
  });

  test('un morceau rangé dans un dossier reste ouvrable', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: bibliotheque([
      { id: 'a', nom: 'Alpha', accords: [{ root: 'C', quality: '' }] },
      { id: 'b', nom: 'Bravo', accords: [{ root: 'D', quality: 'min' }], dossier: 'Jazz' },
    ], 'a') });
    await ouvrirMesMorceaux(page);
    await expect(groupe(page, 'Jazz').locator('.file-row')).toContainText('Bravo');
    await ligne(page, 'Bravo').getByRole('button', { name: 'Ouvrir' }).click();
    await expect(titre(page)).toHaveText('Bravo');
    expect(await noms(page)).toEqual(['Dm']);
  });

  test('« Nouveau morceau » peut être créé directement dans un dossier existant', async ({ ouvrirAppli }) => {
    const page = await ouvrirAvecTrois(ouvrirAppli);
    await ouvrirMesMorceaux(page);
    await fenetreMorceaux(page).getByRole('button', { name: 'Nouveau dossier' }).click();
    await page.locator('#new-folder-input').fill('Jazz');
    await page.locator('#new-folder-input').press('Enter');
    await expect(groupe(page, 'Jazz')).toBeVisible();
    await fenetreMorceaux(page).getByRole('button', { name: 'Fermer' }).click();
    await choisirDansMenuMorceau(page, 'Nouveau morceau');
    const f = page.getByRole('dialog', { name: 'Nouveau morceau' });
    await f.getByRole('textbox', { name: 'Titre du morceau' }).fill('Dans le jazz');
    await f.getByRole('combobox', { name: 'Dossier' }).selectOption({ label: 'Jazz' });
    await f.getByRole('button', { name: 'Créer' }).click();
    await expect(titre(page)).toHaveText('Dans le jazz');
    expect((await morceauxStockes(page)).find(m => m.name === 'Dans le jazz')!.folder).toBe('Jazz');
  });
});
