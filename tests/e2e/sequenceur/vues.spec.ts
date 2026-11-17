// MODULE « sequenceur » — les deux vues : « Accord » (une ligne par note de l'accord) et « Piano » (une ligne par hauteur, de G2 à E5, comme un piano-roll).
// Les mêmes notes se voient dans les deux vues. En vue Piano, poser une note sur une hauteur qui n'est pas dans l'accord crée une NOTE AJOUTÉE
// (voir `notes-ajoutees.spec.ts`). Au téléphone les deux boutons s'appellent « Voix » et « Toutes les notes ».
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  C_AM_F_G, cellule, celluleNote, notesAllumees, nombreAllume, ouvrirSurAccord, boutonEffacer, vueAccord, vuePiano, grille, motifStocke, deplacerVers,
  etirerVers, poigneeDroite, noteDe, attendreNiveau, estMobile,
} from './aide-sequenceur';

async function accordVide(page: Page, n = 1) {
  await ouvrirSurAccord(page, n);
  if (estMobile(page)) await page.locator('#sq-portee-accord').tap();
  await (estMobile(page) ? boutonEffacer(page).tap() : boutonEffacer(page).click());
  await expect.poll(() => nombreAllume(page, n)).toBe(0);
}
const etiquettes = (page: Page) => grille(page).locator('.sq-etiq');

test.describe('Vues Accord et Piano — ordinateur @sequenceur @ordinateur', () => {
  test('la vue Accord montre une ligne par note de l\'accord, la vue Piano toutes les hauteurs de G2 à E5 @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await expect(vueAccord(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(vuePiano(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);   // les trois notes d'Am, de l'aiguë à la grave (colonne des noms, à gauche)
    await vuePiano(page).click();
    await expect(vuePiano(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(vueAccord(page)).toHaveAttribute('aria-pressed', 'false');
    const noms = await etiquettes(page).allTextContents();
    expect(noms.length).toBe(34);
    expect(noms[0]).toBe('E5');
    expect(noms[noms.length - 1]).toBe('G2');
    for (const note of ['E4', 'C4', 'A3']) expect(noms).toContain(note);
    // on peut revenir à la vue Accord
    await vueAccord(page).click();
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);
    expect(garde.bloquees).toEqual([]);
  });

  test('en vue Piano chaque note de l\'accord est sur sa hauteur : A3, C4 et E4 pour Am', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await vuePiano(page).click();
    for (const note of ['A3', 'C4', 'E4']) for (let croche = 1; croche <= 8; croche++) await attendreNiveau(celluleNote(page, 1, note, croche), 'normal');
    await attendreNiveau(celluleNote(page, 1, 'D4', 1), 'vide');
    await attendreNiveau(celluleNote(page, 1, 'B3', 5), 'vide');
    expect(await nombreAllume(page, 1)).toBe(24);
  });

  test('une note posée en vue Accord se retrouve à la même hauteur en vue Piano, et inversement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 3).click();   // voix du milieu d'Am = C4, croche 4
    await expect(noteDe(cellule(page, 1, 1, 3))).toHaveText('C4');
    await vuePiano(page).click();
    await attendreNiveau(celluleNote(page, 1, 'C4', 4), 'normal');
    expect(await nombreAllume(page, 1)).toBe(1);
    // et une note posée en vue Piano (A3, croche 7) revient dans la voix grave en vue Accord
    await celluleNote(page, 1, 'A3', 7).click();
    await attendreNiveau(celluleNote(page, 1, 'A3', 7), 'normal');
    await vueAccord(page).click();
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['0.6:normal', '1.3:normal']);
  });

  test('en vue Piano, une note sur une hauteur de l\'accord est enregistrée comme voix de l\'accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await vuePiano(page).click();
    await celluleNote(page, 1, 'A3', 3).click();
    await attendreNiveau(celluleNote(page, 1, 'A3', 3), 'normal');
    // voix 0 (la plus grave) au pas 4 : « 0 » puis « 0t » (tenue)
    await expect.poll(async () => (await motifStocke(page, 0, 1)).arpPattern?.split(';').slice(4, 6)).toEqual(['0', '0t']);
    expect((await motifStocke(page, 0, 1)).extraNotes ?? []).toEqual([]);
  });

  test('en vue Piano, une note sur une hauteur étrangère à l\'accord crée une note ajoutée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await vuePiano(page).click();
    await celluleNote(page, 1, 'D4', 3).click();
    await attendreNiveau(celluleNote(page, 1, 'D4', 3), 'normal');
    await expect.poll(async () => (await motifStocke(page, 0, 1)).extraNotes).toEqual([{ note: 'D', octave: 4 }]);
    // en vue Accord, elle apparaît comme une quatrième ligne « D4 », rangée par hauteur entre E4 et C4
    await vueAccord(page).click();
    await expect(etiquettes(page)).toHaveText(['E4', 'D4', 'C4', 'A3']);
    await attendreNiveau(celluleNote(page, 1, 'D4', 3), 'normal');
  });

  test('en vue Piano, glisser une note vers une autre ligne change sa hauteur @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await vuePiano(page).click();
    await celluleNote(page, 1, 'A3', 3).click();
    await attendreNiveau(celluleNote(page, 1, 'A3', 3), 'normal');
    await deplacerVers(page, celluleNote(page, 1, 'A3', 3), celluleNote(page, 1, 'C4', 6));
    await attendreNiveau(celluleNote(page, 1, 'C4', 6), 'normal');
    await attendreNiveau(celluleNote(page, 1, 'A3', 3), 'vide');
    expect(await nombreAllume(page, 1)).toBe(1);
    await expect(noteDe(celluleNote(page, 1, 'C4', 6))).toHaveText('C4');
  });

  test('en vue Piano, on étire une note et on la supprime', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await vuePiano(page).click();
    await celluleNote(page, 1, 'E4', 2).click();
    await etirerVers(page, poigneeDroite(celluleNote(page, 1, 'E4', 2)), celluleNote(page, 1, 'E4', 5));
    await expect.poll(() => notesAllumees(page, 1).then(n => n.length)).toBe(4);
    await celluleNote(page, 1, 'E4', 3).click();
    await expect(celluleNote(page, 1, 'E4', 3)).toHaveClass(/\bsq-sel\b/);
    await page.keyboard.press('Delete');
    await expect.poll(() => nombreAllume(page, 1)).toBe(0);
  });

  test('« Effacer » vide aussi la vue Piano ; Ctrl+Z rend l\'accord', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await vuePiano(page).click();
    await boutonEffacer(page).click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(0);
    await page.keyboard.press('Control+z');
    await expect.poll(() => nombreAllume(page, 1)).toBe(24);
  });
});

test.describe('Vues — téléphone @sequenceur @mobile', () => {
  test('les boutons « Voix » et « Toutes les notes » changent la vue @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await expect(vueAccord(page).locator('.sq-vue-tel')).toHaveText('Voix');   // le bouton garde aussi le libellé de l'ordinateur, masqué
    await expect(vuePiano(page).locator('.sq-vue-tel')).toHaveText('Toutes les notes');
    await expect(vueAccord(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);
    await vuePiano(page).tap();
    await expect(vuePiano(page)).toHaveAttribute('aria-pressed', 'true');
    const noms = await etiquettes(page).allTextContents();   // moins de hauteurs qu'à l'ordinateur (écran étroit), mais plus que les trois notes de l'accord
    expect(noms.length).toBeGreaterThan(3);
    for (const note of ['E4', 'C4', 'A3']) expect(noms).toContain(note);
    await attendreNiveau(celluleNote(page, 1, 'C4', 1), 'normal');
    await vueAccord(page).tap();
    await expect(etiquettes(page)).toHaveText(['E4', 'C4', 'A3']);
  });

  test('en vue « Toutes les notes », un toucher pose une note à la hauteur touchée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await vuePiano(page).tap();
    await celluleNote(page, 1, 'A3', 4).tap();
    await attendreNiveau(celluleNote(page, 1, 'A3', 4), 'normal');
    expect(await nombreAllume(page, 1)).toBe(1);
    await vueAccord(page).tap();
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['0.3:normal']);
  });
});
