// MODULE « fichiers » — au téléphone : les mêmes fonctions (menu du nom, « Fichier », fenêtres) doivent tenir dans l'écran et se commander au toucher.
// Les parcours eux-mêmes (enregistrer, ouvrir, exporter, importer) sont éprouvés sans étiquette d'appareil par les autres specs, qui tournent aussi ici.
import { test, expect } from '../support/fixtures';
import type { Locator, Page } from '@playwright/test';
import {
  C_AM_F_G, bibliotheque, titre, boutonEnregistrer, boutonFichiers, ouvrirMenuMorceau, ouvrirMesMorceaux, fenetreMorceaux, ouvrirMenuFichiers,
  choisirDansMenuFichiers, choisirDansMenuMorceau, fenetreNouveau, enregistrerSous, morceauxStockes, ligne, noms,
} from './aide-fichiers';

const TROIS = bibliotheque([
  { id: 'a', nom: 'Alpha', accords: C_AM_F_G },
  { id: 'b', nom: 'Bravo', accords: [{ root: 'D', quality: 'min' }] },
], 'a');

async function tientDansL_ecran(page: Page, l: Locator) {
  const b = (await l.boundingBox())!, v = page.viewportSize()!;
  expect(b.x).toBeGreaterThanOrEqual(-1);
  expect(b.y).toBeGreaterThanOrEqual(-1);
  expect(b.x + b.width).toBeLessThanOrEqual(v.width + 1);
  expect(b.y + b.height).toBeLessThanOrEqual(v.height + 1);
}

test.describe('Fichiers au téléphone @fichiers @mobile', () => {
  test('le nom du morceau, « Enregistrer » et « Fichier » sont visibles, dans l\'écran, au toucher @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: TROIS });
    for (const l of [titre(page), boutonEnregistrer(page), boutonFichiers(page)]) { await expect(l).toBeVisible(); await tientDansL_ecran(page, l); }
    await expect(titre(page)).toHaveText('Alpha');
  });

  test('le menu du nom s\'ouvre au toucher, tient dans l\'écran et ouvre « Mes morceaux » @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: TROIS });
    await titre(page).tap();
    const menu = page.getByRole('menu', { name: 'Morceau' });
    await expect(menu).toBeVisible();
    await tientDansL_ecran(page, menu);
    await menu.getByRole('menuitem', { name: 'Mes morceaux…' }).tap();
    await expect(fenetreMorceaux(page)).toBeVisible();
    await tientDansL_ecran(page, fenetreMorceaux(page));
    await ligne(page, 'Bravo').getByRole('button', { name: 'Ouvrir' }).tap();
    await expect(titre(page)).toHaveText('Bravo');
    expect(await noms(page)).toEqual(['Dm']);
  });

  test('le menu « Fichier » liste les exports et l\'import MIDI, sans « Choisir un dossier » ni rangement sur le disque @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: TROIS });
    await ouvrirMenuFichiers(page);
    for (const n of [/Export intégral/, /Exporter en PDF/, /Exporter en MIDI/, /Exporter en MP3/, /Importer un MIDI/])
      await expect(page.getByRole('button', { name: n })).toBeVisible();
    const peutRanger = await page.evaluate(() => typeof (window as any).showDirectoryPicker === 'function');
    await expect(page.getByRole('button', { name: /Choisir un dossier de rangement/ })).toHaveCount(peutRanger ? 1 : 0);
    const menuFichiers = page.getByRole('button', { name: /Exporter en PDF/ });
    await tientDansL_ecran(page, menuFichiers);
  });

  test('les fenêtres d\'export PDF et d\'export intégral tiennent dans l\'écran', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: TROIS });
    await choisirDansMenuFichiers(page, /Exporter en PDF/);
    await tientDansL_ecran(page, page.getByRole('dialog', { name: 'Exporter en PDF' }));
    await page.getByRole('dialog', { name: 'Exporter en PDF' }).getByRole('button', { name: 'Annuler' }).tap();
    await choisirDansMenuFichiers(page, /Export intégral/);
    await tientDansL_ecran(page, page.getByRole('dialog', { name: 'Export intégral du morceau' }));
  });

  test('créer puis enregistrer un morceau neuf au toucher @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ reglages: TROIS });
    await choisirDansMenuMorceau(page, 'Nouveau morceau');
    await tientDansL_ecran(page, fenetreNouveau(page));
    await fenetreNouveau(page).getByRole('textbox', { name: 'Titre du morceau' }).fill('Au doigt');
    await fenetreNouveau(page).getByRole('button', { name: 'Créer' }).tap();
    await expect(titre(page)).toHaveText('Au doigt');
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Alpha', 'Bravo', 'Au doigt']);
    await ouvrirMenuMorceau(page);
    await expect(page.getByRole('menu', { name: 'Morceau' }).getByRole('menuitemradio')).toHaveCount(3);
  });

  test('un morceau neuf se nomme et s\'enregistre avec la disquette', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G, reglages: { harmohubSongs: '[]', harmohubCurrentSongId: '' } });
    await enregistrerSous(page, 'Venu du doigt');
    expect((await morceauxStockes(page)).map(m => m.name)).toEqual(['Venu du doigt']);
  });
});
