// MODULE « sequenceur » — l'intensité des notes. Bouton « Intensité » (mf) : éteint, un clic sur une note la sélectionne ; allumé, un clic sur
// une note change sa force : normal → fort → doux → normal. La force est enregistrée par note (`intensiteVoix`, « voix:pas » → 90 fort, 55 doux).
// Une note étirée garde une seule force pour toute sa durée. Un clic sur une case vide pose toujours une note normale.
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  C_AM_F_G, cellule, notesAllumees, nombreAllume, ouvrirSurAccord, boutonEffacer, boutonIntensite, etirerVers, poigneeDroite, attendreNiveau, motifStocke,
  toucher, estMobile, sequenceur,
} from './aide-sequenceur';
import { repondreAuxConfirmations } from '../grille/aide-grille';

async function accordVide(page: Page, n = 1) {
  await ouvrirSurAccord(page, n);
  if (estMobile(page)) await page.locator('#sq-portee-accord').tap();
  await (estMobile(page) ? boutonEffacer(page).tap() : boutonEffacer(page).click());
  await expect.poll(() => nombreAllume(page, n)).toBe(0);
}
const allumerIntensite = async (page: Page) => {
  await (estMobile(page) ? boutonIntensite(page).tap() : boutonIntensite(page).click());
  await expect(boutonIntensite(page)).toHaveAttribute('aria-pressed', 'true');
};

test.describe('Intensité — ordinateur @sequenceur @ordinateur', () => {
  test('le bouton « Intensité » s\'allume et s\'éteint, et dit dans son infobulle ce qu\'il fait', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await expect(boutonIntensite(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(boutonIntensite(page)).toHaveAttribute('title', /^Intensité éteinte/);
    await boutonIntensite(page).click();
    await expect(boutonIntensite(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(boutonIntensite(page)).toHaveAttribute('title', /^Intensité allumée/);
    await boutonIntensite(page).click();
    await expect(boutonIntensite(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('allumée, chaque clic sur une note la fait passer de normal à fort, à doux, puis à normal @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 3).click();
    await attendreNiveau(cellule(page, 1, 1, 3), 'normal');
    await allumerIntensite(page);
    await cellule(page, 1, 1, 3).click();
    await attendreNiveau(cellule(page, 1, 1, 3), 'fort');
    await expect.poll(async () => (await motifStocke(page, 0, 1)).intensiteVoix).toEqual({ '1:6': 90 });
    await cellule(page, 1, 1, 3).click();
    await attendreNiveau(cellule(page, 1, 1, 3), 'doux');
    await expect.poll(async () => (await motifStocke(page, 0, 1)).intensiteVoix).toEqual({ '1:6': 55 });
    await cellule(page, 1, 1, 3).click();
    await attendreNiveau(cellule(page, 1, 1, 3), 'normal');
    await expect.poll(async () => (await motifStocke(page, 0, 1)).intensiteVoix).toEqual({});
    expect(await nombreAllume(page, 1)).toBe(1);   // la note n'a jamais disparu
    expect(garde.bloquees).toEqual([]);
  });

  test('éteinte, un clic sur une note ne change pas sa force', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 3).click();
    await cellule(page, 1, 1, 3).click();
    await cellule(page, 1, 1, 3).click();
    await attendreNiveau(cellule(page, 1, 1, 3), 'normal');
    expect((await motifStocke(page, 0, 1)).intensiteVoix ?? {}).toEqual({});
  });

  test('la force se règle note par note : les autres notes gardent la leur', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    for (const [v, k] of [[0, 0], [1, 3], [2, 6]]) await cellule(page, 1, v, k).click();
    await allumerIntensite(page);
    await cellule(page, 1, 0, 0).click();                       // fort
    await cellule(page, 1, 2, 6).click(); await cellule(page, 1, 2, 6).click();   // doux
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['0.0:fort', '1.3:normal', '2.6:doux']);
  });

  test('une note étirée a une seule force pour toute sa durée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 2).click();
    await etirerVers(page, poigneeDroite(cellule(page, 1, 1, 2)), cellule(page, 1, 1, 5));
    await expect.poll(() => nombreAllume(page, 1)).toBe(4);
    await allumerIntensite(page);
    await cellule(page, 1, 1, 4).click();   // au milieu de la note
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['1.2:fort', '1.3:fort', '1.4:fort', '1.5:fort']);
  });

  test('allumée, un clic sur une case vide pose toujours une note normale', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await allumerIntensite(page);
    await cellule(page, 1, 2, 5).click();
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['2.5:normal']);
  });

  test('Ctrl+Z défait un changement de force', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 3).click();
    await allumerIntensite(page);
    await cellule(page, 1, 1, 3).click();
    await attendreNiveau(cellule(page, 1, 1, 3), 'fort');
    await page.keyboard.press('Control+z');
    await attendreNiveau(cellule(page, 1, 1, 3), 'normal');
  });

  test('les forces sont retrouvées après un rechargement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    repondreAuxConfirmations(page);
    await accordVide(page);
    await cellule(page, 1, 1, 3).click();
    await allumerIntensite(page);
    await cellule(page, 1, 1, 3).click();
    await attendreNiveau(cellule(page, 1, 1, 3), 'fort');
    await page.reload();
    await expect(sequenceur(page)).toBeVisible();
    await attendreNiveau(cellule(page, 1, 1, 3), 'fort');
  });
});

test.describe('Intensité — téléphone @sequenceur @mobile', () => {
  test('le cycle fort → doux → normal boucle, sans jamais enlever la note @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await toucher(page, cellule(page, 1, 1, 3));
    await attendreNiveau(cellule(page, 1, 1, 3), 'normal');
    await allumerIntensite(page);
    for (const attendu of ['fort', 'doux', 'normal', 'fort', 'doux'] as const) {
      await toucher(page, cellule(page, 1, 1, 3));
      await attendreNiveau(cellule(page, 1, 1, 3), attendu);
    }
    expect(await nombreAllume(page, 1)).toBe(1);
  });

  test('éteinte, un toucher sur une note l\'enlève au lieu de changer sa force', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await toucher(page, cellule(page, 1, 1, 3));
    await attendreNiveau(cellule(page, 1, 1, 3), 'normal');
    await expect(boutonIntensite(page)).toHaveAttribute('aria-pressed', 'false');
    await toucher(page, cellule(page, 1, 1, 3));
    await attendreNiveau(cellule(page, 1, 1, 3), 'vide');
  });
});
