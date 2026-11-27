// MODULE « fichiers » — le TRI de « Mes morceaux » (demande de l'utilisateur du 26/11) : dossiers ET morceaux, par nom (ordre alphabétique) ou par date de dernière
// modification, dans les deux sens ; le choix est retenu. « Sans dossier » reste en dernier.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import { bibliotheque, ouvrirMesMorceaux, fenetreMorceaux } from './aide-fichiers';

const UN = [{ root: 'C', quality: '' }];
const T = (n: number) => Date.UTC(2026, 10, n, 12);                      // n novembre 2026
// Noms choisis pour piéger le tri : casse, accent, chiffres.
const BIBLIO = bibliotheque([
  { id: 'a', nom: 'Zèbre', accords: UN, dossier: 'Beta', savedAt: T(10) },
  { id: 'b', nom: 'abeille', accords: UN, dossier: 'Alpha', savedAt: T(1) },
  { id: 'c', nom: 'Arbre 10', accords: UN, dossier: 'Alpha', savedAt: T(4) },
  { id: 'd', nom: 'Arbre 2', accords: UN, dossier: 'Alpha', savedAt: T(2) },
  { id: 'e', nom: 'Moto', accords: UN, savedAt: T(3) },
  { id: 'f', nom: 'Étoile', accords: UN, savedAt: T(5) },
], 'a');

const groupes = (page: Page) => fenetreMorceaux(page).locator('details.file-group');
const ordre = async (page: Page) => {
  const sortie: string[] = [];
  for (const g of await groupes(page).all()) {
    sortie.push(`# ${((await g.locator('.file-group-name').textContent()) || '').trim()}`);
    for (const n of await g.locator('.file-name').all()) sortie.push(((await n.textContent()) || '').replace(/\s+—\s*ouvert/, '').trim());
  }
  return sortie;
};
const segment = (page: Page, nom: string) => fenetreMorceaux(page).getByRole('radio', { name: nom, exact: true });
const sens = (page: Page) => fenetreMorceaux(page).locator('#files-tri-sens');

test.describe('Tri de « Mes morceaux » @fichiers', () => {
  test('par défaut : les plus récemment modifiés d\'abord, dossiers compris ; « Sans dossier » en dernier @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: BIBLIO });
    await ouvrirMesMorceaux(page);
    await expect(segment(page, 'Modifié')).toHaveAttribute('aria-checked', 'true');
    await expect(segment(page, 'Nom')).toHaveAttribute('aria-checked', 'false');
    expect(await ordre(page)).toEqual(['# Beta', 'Zèbre', '# Alpha', 'Arbre 10', 'Arbre 2', 'abeille', '# Sans dossier', 'Étoile', 'Moto']);
    await expect(sens(page)).toHaveText('Récents d\'abord');
  });

  test('« Nom » : ordre alphabétique des dossiers et des morceaux (casse, accents et nombres bien classés) @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: BIBLIO });
    await ouvrirMesMorceaux(page);
    await segment(page, 'Nom').click();
    await expect(segment(page, 'Nom')).toHaveAttribute('aria-checked', 'true');
    await expect(sens(page)).toHaveText('A → Z');
    expect(await ordre(page)).toEqual(['# Alpha', 'abeille', 'Arbre 2', 'Arbre 10', '# Beta', 'Zèbre', '# Sans dossier', 'Étoile', 'Moto']);
  });

  test('le bouton d\'ordre inverse le tri : Z → A, puis anciens d\'abord ; « Sans dossier » reste en dernier @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: BIBLIO });
    await ouvrirMesMorceaux(page);
    await segment(page, 'Nom').click();
    await sens(page).click();
    await expect(sens(page)).toHaveText('Z → A');
    expect(await ordre(page)).toEqual(['# Beta', 'Zèbre', '# Alpha', 'Arbre 10', 'Arbre 2', 'abeille', '# Sans dossier', 'Moto', 'Étoile']);
    await segment(page, 'Modifié').click();                             // changer de critère reprend son sens naturel : récents d'abord
    await expect(sens(page)).toHaveText('Récents d\'abord');
    await sens(page).click();
    await expect(sens(page)).toHaveText('Anciens d\'abord');
    expect(await ordre(page)).toEqual(['# Alpha', 'abeille', 'Arbre 2', 'Arbre 10', '# Beta', 'Zèbre', '# Sans dossier', 'Moto', 'Étoile']);
  });

  test('le choix est retenu : on rouvre la fenêtre, on recharge la page, il est toujours là', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: BIBLIO });
    await ouvrirMesMorceaux(page);
    await segment(page, 'Nom').click();
    await sens(page).click();                                           // Z → A
    await page.keyboard.press('Escape');
    await expect(fenetreMorceaux(page)).toBeHidden();
    await ouvrirMesMorceaux(page);
    await expect(sens(page)).toHaveText('Z → A');
    await page.reload();
    await page.waitForFunction(() => !!(window as any).app);
    await ouvrirMesMorceaux(page);
    await expect(segment(page, 'Nom')).toHaveAttribute('aria-checked', 'true');
    await expect(sens(page)).toHaveText('Z → A');
    expect((await ordre(page))[0]).toBe('# Beta');
  });

  test('un dossier vide passe après les autres en tri par date, quel que soit le sens ; en tri par nom il reste à sa place', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: { ...BIBLIO, harmohubFolders: JSON.stringify(['Alpha', 'Beta', 'Aaa vide']) } });
    await ouvrirMesMorceaux(page);
    expect((await ordre(page)).filter(l => l.startsWith('#'))).toEqual(['# Beta', '# Alpha', '# Aaa vide', '# Sans dossier']);
    await sens(page).click();                                            // anciens d'abord
    expect((await ordre(page)).filter(l => l.startsWith('#'))).toEqual(['# Alpha', '# Beta', '# Aaa vide', '# Sans dossier']);
    await segment(page, 'Nom').click();
    expect((await ordre(page)).filter(l => l.startsWith('#'))).toEqual(['# Aaa vide', '# Alpha', '# Beta', '# Sans dossier']);
  });

  test('le tri se fait au clavier (Tab, Entrée) et le focus reste sur le bouton pressé', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: BIBLIO });
    await ouvrirMesMorceaux(page);
    await segment(page, 'Nom').focus();
    await page.keyboard.press('Enter');
    await expect(segment(page, 'Nom')).toBeFocused();
    await sens(page).focus();
    await page.keyboard.press('Enter');
    await expect(sens(page)).toBeFocused();
    await expect(sens(page)).toHaveText('Z → A');
  });
});
