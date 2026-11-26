// MODULE « structure » — changer la MÉTRIQUE après coup (essai neutre du 25/11, SN-06). Les durées des accords ne sont pas recalées (la durée du morceau reste
// juste) : les passages peuvent donc compter des mesures fractionnaires. Ce que la structure doit garantir : une virgule comme la grille, et jamais une plage
// « mes. 1–0.7 » (fin avant le début).
import { test, expect } from '../support/fixtures';
import { morceauTroisParties, ouvrirStructure, lire, estMobile, plus, appuyer } from './aide-structure';
import type { Page } from '@playwright/test';

async function regler(page: Page, metrique: string) {
  if (estMobile(page)) {
    await page.locator('#song-summary').tap();
    await page.getByRole('group', { name: 'Réglages du morceau' }).getByRole('button', { name: /^Mesure/ }).tap();
    await page.getByRole('listbox', { name: 'Mesure' }).getByText(metrique, { exact: true }).tap();
    await expect(page.locator('#song-summary')).toContainText(metrique);
  } else {
    await page.getByRole('button', { name: /^Mesure/ }).click();
    await page.getByRole('listbox', { name: 'Mesure' }).getByText(metrique, { exact: true }).click();
    await expect(page.getByRole('button', { name: /^Mesure/ })).toContainText(metrique);
  }
}

test.describe('Changer de métrique @structure', () => {
  for (const metrique of ['3/4', '6/8', '12/8', '5/4']) {
    test(`en ${metrique} : virgule décimale, positions entières, jamais une plage à l'envers @critique`, async ({ ouvrirAppli }) => {
      const page = await ouvrirAppli(morceauTroisParties());
      await regler(page, metrique);
      await ouvrirStructure(page);
      await appuyer(page, plus(page, 0));                                  // ×2 : la plage s'allonge, mais reste cohérente
      const v = await lire(page);
      expect(v.mesures).not.toMatch(/\d\.\d/);
      let precedente = 0;
      for (const l of v.lignes) {
        expect(l.mesures).not.toMatch(/\d\.\d/);                           // « 5,3 mes. », jamais « 5.3 mes. »
        const m = l.position.match(/^mes\. (\d+)(?:–(\d+))?$/);
        expect(m, `position « ${l.position} »`).not.toBeNull();            // deux nombres entiers, ou un seul
        const debut = Number(m![1]), fin = m![2] ? Number(m![2]) : debut;
        expect(fin).toBeGreaterThanOrEqual(debut);                          // jamais « 1–0.7 »
        expect(debut).toBeGreaterThanOrEqual(precedente);                   // les passages se suivent
        precedente = fin;
      }
    });
  }

  test('un passage d\'une seule mesure s\'écrit « mes. 3 », pas « mes. 3–3 »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli(morceauTroisParties([{ titre: 'Court', accords: [{ root: 'C', quality: '', beats: 4 }] }, { titre: 'Un', accords: [{ root: 'G', quality: '', beats: 4 }] }, { titre: 'Deux', accords: [{ root: 'A', quality: 'min', beats: 4 }] }]));
    await ouvrirStructure(page);
    expect((await lire(page)).lignes.map(l => l.position)).toEqual(['mes. 1', 'mes. 2', 'mes. 3']);
  });
});
