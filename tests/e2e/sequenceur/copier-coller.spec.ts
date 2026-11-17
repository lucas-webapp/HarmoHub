// MODULE « sequenceur » — copier le rythme d'un accord et le coller sur un autre (boutons « Copier le rythme de cet accord » / « Coller le rythme de X sur Y »).
// Le rythme copié reste en mémoire : on peut le coller sur plusieurs accords. Il est collé avec ses forces (fort, doux). Il remplace celui de la cible.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  C_AM_F_G, rythme, boutonCopier, boutonColler, boutonEffacer, boutonIntensite, cellule, notesAllumees, nombreAllume, ouvrirSurAccord, choisirAccord,
  attendreNiveau, motifStocke, estMobile, toucher,
} from './aide-sequenceur';

const appuyer = (page: Page, l: ReturnType<Page['locator']>) => (estMobile(page) ? l.tap() : l.click());
// Au téléphone un rythme se choisit pour « Toute la partie » par défaut : on le limite à l'accord pour que chaque test sache ce qu'il a.
async function ouvrir(page: Page, n = 1) {
  await ouvrirSurAccord(page, n);
  if (estMobile(page)) await page.locator('#sq-portee-accord').tap();
}

for (const [etiquette, tag] of [['ordinateur', '@ordinateur'], ['téléphone', '@mobile']] as const) {
  test.describe(`Copier / coller un rythme — ${etiquette} @sequenceur ${tag}`, () => {
    test(`le rythme copié sur Am se colle sur F : mêmes notes, mêmes croches @critique`, async ({ ouvrirAppli, garde }) => {
      const page = await ouvrirAppli({ accords: C_AM_F_G });
      await ouvrir(page, 1);
      await appuyer(page, rythme(page, 'pompe'));
      await expect.poll(() => nombreAllume(page, 1)).toBe(8);
      const modele = await notesAllumees(page, 1);
      await appuyer(page, boutonCopier(page));
      await expect(boutonColler(page)).toBeEnabled();
      await expect(boutonColler(page)).toHaveAccessibleName('Coller le rythme de Am sur Am');
      await choisirAccord(page, estMobile(page) ? 1 : 2);   // téléphone : une flèche de la feuille, de Am vers F
      await expect(boutonColler(page)).toHaveAccessibleName('Coller le rythme de Am sur F');
      expect(await nombreAllume(page, 2)).toBe(24);   // F est encore tenu
      await appuyer(page, boutonColler(page));
      await expect.poll(() => notesAllumees(page, 2)).toEqual(modele);
      // enregistré : le même motif de seize pas sur les deux accords (la source n'a pas bougé)
      const source = (await motifStocke(page, 0, 1)).arpPattern;
      expect(source).toBe('0;0t;0t;0t;1,2;1t,2t;;;0;0t;0t;0t;1,2;1t,2t;;');
      expect((await motifStocke(page, 0, 2)).arpPattern).toBe(source);
      expect(garde.bloquees).toEqual([]);
    });

    test('le rythme copié se colle plusieurs fois, et remplace celui de la cible', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli({ accords: C_AM_F_G });
      await ouvrir(page, 1);
      await appuyer(page, rythme(page, 'monte'));
      await expect.poll(() => nombreAllume(page, 1)).toBe(14);
      const modele = await notesAllumees(page, 1);
      await appuyer(page, boutonCopier(page));
      await choisirAccord(page, estMobile(page) ? 1 : 2);
      await appuyer(page, rythme(page, 'ballade'));   // la cible a déjà un rythme : « Ballade »
      await expect.poll(() => nombreAllume(page, 2)).toBe(16);
      await appuyer(page, boutonColler(page));
      await expect.poll(() => notesAllumees(page, 2)).toEqual(modele);
      await choisirAccord(page, estMobile(page) ? 1 : 3);
      await appuyer(page, boutonColler(page));
      await expect.poll(() => notesAllumees(page, 3)).toEqual(modele);
    });

    test('les forces (fort, doux) sont collées avec le rythme', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli({ accords: C_AM_F_G });
      await ouvrir(page, 1);
      await appuyer(page, boutonEffacer(page));
      await expect.poll(() => nombreAllume(page, 1)).toBe(0);
      await toucher(page, cellule(page, 1, 0, 1));
      await toucher(page, cellule(page, 1, 2, 5));
      await expect.poll(() => nombreAllume(page, 1)).toBe(2);
      await appuyer(page, boutonIntensite(page));
      await toucher(page, cellule(page, 1, 0, 1));   // fort
      await toucher(page, cellule(page, 1, 2, 5));
      await toucher(page, cellule(page, 1, 2, 5));   // doux
      await expect.poll(() => notesAllumees(page, 1)).toEqual(['0.1:fort', '2.5:doux']);
      await appuyer(page, boutonCopier(page));
      await choisirAccord(page, estMobile(page) ? 1 : 2);
      await appuyer(page, boutonColler(page));
      await expect.poll(() => notesAllumees(page, 2)).toEqual(['0.1:fort', '2.5:doux']);
    });

    test('Annuler défait le collage', async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli({ accords: C_AM_F_G });
      await ouvrir(page, 1);
      await appuyer(page, rythme(page, 'pompe'));
      await expect.poll(() => nombreAllume(page, 1)).toBe(8);
      await appuyer(page, boutonCopier(page));
      await choisirAccord(page, estMobile(page) ? 1 : 2);
      await appuyer(page, boutonColler(page));
      await expect.poll(() => nombreAllume(page, 2)).toBe(8);
      await page.keyboard.press('Control+z');
      await expect.poll(() => nombreAllume(page, 2)).toBe(24);
    });
  });
}

test.describe('Copier / coller un rythme — ordinateur seulement @sequenceur @ordinateur', () => {
  test('copier ne change rien à la grille et le bouton « Coller » reste actif pour les accords suivants', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 0);
    await expect(boutonColler(page)).toBeDisabled();
    const avant = await notesAllumees(page, 0);
    await boutonCopier(page).click();
    expect(await notesAllumees(page, 0)).toEqual(avant);
    for (const n of [1, 2, 3]) {
      await choisirAccord(page, n);
      await expect(boutonColler(page)).toBeEnabled();
    }
    await expect(boutonColler(page)).toHaveAccessibleName('Coller le rythme de C sur G');
  });

  test('on peut coller un rythme tenu (jamais retouché) : la cible devient tenue', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await boutonCopier(page).click();   // Am est tenu
    await choisirAccord(page, 2);
    await rythme(page, 'pompe').click();
    await expect.poll(() => nombreAllume(page, 2)).toBe(8);
    await boutonColler(page).click();
    await expect.poll(() => nombreAllume(page, 2)).toBe(24);
  });
});
