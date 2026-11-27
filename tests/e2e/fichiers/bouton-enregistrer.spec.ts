// MODULE « fichiers » — le BOUTON ENREGISTRER ne doit jamais être recouvert par le titre du morceau (retour de l'utilisateur du 26/11, capture à l'appui : « dès que j'enregistre,
// il y a un petit bug avec le bouton enregistrer »). Cause : le conteneur du titre pouvait rétrécir sous les 128 px du bouton qu'il porte ; quand le voyant s'allongeait
// (« Enregistré à 11:45 » à la place de « Nouveau morceau »), le bouton du titre débordait de 6 px sur Enregistrer, entre 1000 et 1280 px de large.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import { enregistrerSous, titre, boutonEnregistrer, etat } from './aide-fichiers';

const droite = async (page: Page, sel: string) => (await page.locator(sel).boundingBox())!;

test.describe('Bouton Enregistrer et titre du morceau @fichiers @ordinateur', () => {
  test.beforeEach(async ({}, info) => { test.skip(/mobile|iphone/i.test(info.project.name), 'barre de l\'ordinateur : le téléphone a la sienne (voir module mobile)'); });

  for (const largeur of [900, 1000, 1100, 1280, 1500, 1920]) {
    test(`à ${largeur} px, avant comme après « Enregistrer », le titre ne passe pas sous le bouton Enregistrer @critique`, async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli({});
      await page.setViewportSize({ width: largeur, height: 800 });
      const verifier = async (quand: string) => {
        const t = await droite(page, '#tb-titre'), s = await droite(page, '#tb-save');
        expect(t.x + t.width, `${quand} : le titre finit à ${t.x + t.width}, Enregistrer commence à ${s.x}`).toBeLessThanOrEqual(s.x + 0.5);
        expect(t.width).toBeGreaterThanOrEqual(127.5);                        // le titre garde sa largeur minimale (128 px)
        expect(s.width).toBeGreaterThanOrEqual(31.5);                         // et Enregistrer la sienne (32 px, la jauge)
      };
      await verifier('morceau neuf');
      await enregistrerSous(page, 'Essai');
      await expect(etat(page)).toContainText('Enregistré');
      await verifier('juste après l\'enregistrement');
      await expect(titre(page)).toHaveText('Essai');
      await expect(boutonEnregistrer(page)).toBeVisible();
    });
  }
});
