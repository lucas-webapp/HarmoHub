// MODULE « grille » — les parties (sections) : ajouter, renommer, dupliquer, supprimer, réordonner (Monter / Descendre), répéter.
// Le menu « … » d'une partie est le même sur ordinateur et sur téléphone ; seuls les gestes changent (clic / toucher).
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import { C_AM_F_G, noms, titres, titresParties, ouvrirMenuPartie, reglagesMorceau, repondreAuxConfirmations, estMobile } from './aide-grille';

const DEUX_PARTIES = () => ({ reglages: reglagesMorceau([
  { titre: 'Couplet', accords: C_AM_F_G }, { titre: 'Refrain', accords: [{ root: 'D', quality: 'min' }, { root: 'E', quality: 'min' }] },
]) });
const parties = (page: Page) => page.locator('#progression-sections .prog-section');
const annuler = (page: Page) => page.getByRole('button', { name: 'Annuler', exact: true });
// Au téléphone on touche, à l'ordinateur on clique.
const appuyer = async (page: Page, loc: import('@playwright/test').Locator) => (estMobile(page) ? loc.tap() : loc.click());

for (const [mode, etiquette] of [['ordinateur', '@ordinateur'], ['téléphone', '@mobile']] as const) {
  test.describe(`Parties — ${mode} @grille ${etiquette}`, () => {
    test('« Ajouter section » crée une partie vide à la suite @critique', async ({ ouvrirAppli, garde }) => {
      const page = await ouvrirAppli({ accords: C_AM_F_G });
      await expect(parties(page)).toHaveCount(1);
      await appuyer(page, page.getByRole('button', { name: 'Ajouter une section' }));
      await expect(parties(page)).toHaveCount(2);
      expect(await noms(page, 1)).toEqual([]);
      expect(await noms(page, 0)).toEqual(['C', 'Am', 'F', 'G']);
      expect(await titres(page)).toEqual(['Couplet', '']);
      expect(garde.bloquees).toEqual([]);
    });

    test('renommer une partie dans son champ de titre, et le titre survit au rechargement @critique', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli(DEUX_PARTIES());
      const titre = titresParties(page).nth(1);
      await appuyer(page, titre);
      await titre.fill('Pont');
      await titre.press('Enter');
      await expect(titre).toHaveValue('Pont');
      expect(await titres(page)).toEqual(['Couplet', 'Pont']);
      await page.reload();
      await expect(parties(page)).toHaveCount(2);
      expect(await titres(page)).toEqual(['Couplet', 'Pont']);
    });

    test('« Renommer » du menu de la partie met le curseur dans son titre', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli(DEUX_PARTIES());
      const menu = await ouvrirMenuPartie(page, 1);
      await appuyer(page, menu.getByRole('menuitem', { name: 'Renommer' }));
      await expect(titresParties(page).nth(1)).toBeFocused();
      await page.keyboard.press('Control+a');
      await page.keyboard.type('Intro');
      await page.keyboard.press('Enter');
      expect(await titres(page)).toEqual(['Couplet', 'Intro']);
    });

    test('« Dupliquer » ajoute une copie complète de la partie, juste après @critique', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli(DEUX_PARTIES());
      const menu = await ouvrirMenuPartie(page, 0);
      await appuyer(page, menu.getByRole('menuitem', { name: 'Dupliquer' }));
      await expect(parties(page)).toHaveCount(3);
      expect(await titres(page)).toEqual(['Couplet', 'Couplet (copie)', 'Refrain']);
      expect(await noms(page, 1)).toEqual(['C', 'Am', 'F', 'G']);
      expect(await noms(page, 2)).toEqual(['Dm', 'Em']);
    });

    test('« Supprimer la partie » demande confirmation, puis retire la partie et ses accords @critique', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli(DEUX_PARTIES());
      const messages = repondreAuxConfirmations(page, true);
      const menu = await ouvrirMenuPartie(page, 0);
      await appuyer(page, menu.getByRole('menuitem', { name: 'Supprimer la partie' }));
      await expect.poll(() => messages).toEqual(['Supprimer « Couplet » et ses 4 accord(s) ?']);
      await expect(parties(page)).toHaveCount(1);
      expect(await titres(page)).toEqual(['Refrain']);
      expect(await noms(page)).toEqual(['Dm', 'Em']);
    });

    test('refuser la confirmation garde la partie intacte', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli(DEUX_PARTIES());
      const messages = repondreAuxConfirmations(page, false);
      const menu = await ouvrirMenuPartie(page, 1);
      await appuyer(page, menu.getByRole('menuitem', { name: 'Supprimer la partie' }));
      await expect.poll(() => messages.length).toBe(1);
      await expect(parties(page)).toHaveCount(2);
      expect(await noms(page, 1)).toEqual(['Dm', 'Em']);
    });

    test('« Monter » et « Descendre » réordonnent les parties avec leurs accords @critique', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli(DEUX_PARTIES());
      let menu = await ouvrirMenuPartie(page, 1);
      await appuyer(page, menu.getByRole('menuitem', { name: 'Monter' }));
      expect(await titres(page)).toEqual(['Refrain', 'Couplet']);
      expect(await noms(page, 0)).toEqual(['Dm', 'Em']);
      expect(await noms(page, 1)).toEqual(['C', 'Am', 'F', 'G']);
      menu = await ouvrirMenuPartie(page, 0);
      await appuyer(page, menu.getByRole('menuitem', { name: 'Descendre' }));
      expect(await titres(page)).toEqual(['Couplet', 'Refrain']);
    });

    test('la première partie ne peut pas monter, la dernière ne peut pas descendre', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli(DEUX_PARTIES());
      let menu = await ouvrirMenuPartie(page, 0);
      await expect(menu.getByRole('menuitem', { name: 'Monter' })).toBeDisabled();
      await expect(menu.getByRole('menuitem', { name: 'Descendre' })).toBeEnabled();
      await page.keyboard.press('Escape');
      menu = await ouvrirMenuPartie(page, 1);
      await expect(menu.getByRole('menuitem', { name: 'Descendre' })).toBeDisabled();
      await expect(menu.getByRole('menuitem', { name: 'Monter' })).toBeEnabled();
    });

    test('la répétition d\'une partie s\'écrit ×2 puis revient à ×1', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli(DEUX_PARTIES());
      const menu = await ouvrirMenuPartie(page, 0);
      await expect(menu).toContainText('×1');
      await appuyer(page, menu.getByRole('button', { name: 'Une répétition de plus' }));
      await expect(parties(page).first()).toContainText('×2');
      await appuyer(page, page.locator('#partie-menu').getByRole('button', { name: 'Une répétition de moins' }));
      await expect(parties(page).first()).not.toContainText('×2');
    });

    test('annuler remet l\'ancien titre, l\'ancien ordre et supprime la copie', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli(DEUX_PARTIES());
      const menu = await ouvrirMenuPartie(page, 0);
      await appuyer(page, menu.getByRole('menuitem', { name: 'Dupliquer' }));
      await expect(parties(page)).toHaveCount(3);
      await appuyer(page, annuler(page));
      await expect(parties(page)).toHaveCount(2);
      expect(await titres(page)).toEqual(['Couplet', 'Refrain']);
      const menu2 = await ouvrirMenuPartie(page, 1);
      await appuyer(page, menu2.getByRole('menuitem', { name: 'Monter' }));
      expect(await titres(page)).toEqual(['Refrain', 'Couplet']);
      await appuyer(page, annuler(page));
      expect(await titres(page)).toEqual(['Couplet', 'Refrain']);
    });
  });
}

test.describe('Parties — ordinateur, compteur de mesures @grille @ordinateur', () => {
  // Défaut observé (voir bugs.md) : après la suppression d'une partie, la barre de lecture garde l'ancien total (« 1 / 6 » alors qu'il reste 4 mesures) ;
  // il ne se corrige qu'au prochain clic sur une case, ou à l'annulation.
  test('après la suppression d\'une partie, la barre de lecture affiche le bon nombre de mesures', async ({ ouvrirAppli }) => {
    test.fail(true, 'G-02 (bugs.md) : bug connu, le test doit repasser au vert quand il sera corrigé');
    const page = await ouvrirAppli(DEUX_PARTIES());
    const mesure = page.locator('#bl-mesure');
    await expect(mesure).toContainText('/ 6');
    repondreAuxConfirmations(page, true);
    const menu = await ouvrirMenuPartie(page, 1);
    await menu.getByRole('menuitem', { name: 'Supprimer la partie' }).click();
    await expect(parties(page)).toHaveCount(1);
    await expect(mesure).toContainText('/ 4');
  });

  test('ajouter une partie met à jour le nombre de mesures de la barre de lecture', async ({ ouvrirAppli }) => {
    test.fail(true, 'G-02 (bugs.md) : bug connu, le test doit repasser au vert quand il sera corrigé');
    const page = await ouvrirAppli(DEUX_PARTIES());
    const mesure = page.locator('#bl-mesure');
    await expect(mesure).toContainText('/ 6');
    const menu = await ouvrirMenuPartie(page, 0);
    await menu.getByRole('menuitem', { name: 'Dupliquer' }).click();
    await expect(parties(page)).toHaveCount(3);
    await expect(mesure).toContainText('/ 10');
  });
});
