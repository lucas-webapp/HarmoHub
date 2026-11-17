// MODULE « sequenceur » — les notes : poser, étirer, raccourcir, déplacer, sélectionner, supprimer, annuler, peindre en glissant.
// On part toujours d'un accord VIDÉ (« Effacer le rythme de cet accord ») pour que chaque test sache exactement ce qu'il pose.
// Ordinateur : clic = poser (case vide) ou sélectionner (note) ; glisser une poignée = étirer ; glisser la note = déplacer ; Suppr = supprimer.
// Téléphone : un toucher pose une croche sur une case vide, et ENLÈVE la note touchée (le doigt sert aussi à faire défiler).
import { test, expect } from '../support/fixtures';
import type { Page } from '@playwright/test';
import {
  C_AM_F_G, cellule, notesAllumees, nombreAllume, croches, ouvrirSurAccord, boutonEffacer, noteDe, poigneeDroite, poigneeGauche, etirerVers, deplacerVers,
  glisser, attendreNiveau, motifStocke, grille, rythme, estMobile, toucher, sequenceur,
} from './aide-sequenceur';
import { repondreAuxConfirmations } from '../grille/aide-grille';

// Ouvre le séquenceur sur l'accord n (Am par défaut), puis vide son rythme.
async function accordVide(page: Page, n = 1) {
  await ouvrirSurAccord(page, n);
  if (estMobile(page)) await page.locator('#sq-portee-accord').tap();
  await (estMobile(page) ? boutonEffacer(page).tap() : boutonEffacer(page).click());
  await expect.poll(() => nombreAllume(page, n)).toBe(0);
}

test.describe('Notes — ordinateur @sequenceur @ordinateur', () => {
  test('un clic sur une case vide pose une note d\'une croche, qui porte le nom de sa voix @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    const c = cellule(page, 1, 1, 3);
    await attendreNiveau(c, 'vide');
    await c.click();
    await attendreNiveau(c, 'normal');
    expect(await notesAllumees(page, 1)).toEqual(['1.3:normal']);
    await expect(noteDe(c)).toHaveText('C4');   // la deuxième voix d'Am est un do
    // enregistré : seize pas par mesure, une croche = deux pas (« 1 » puis « 1t », la tenue)
    await expect.poll(async () => (await motifStocke(page, 0, 1)).arpPattern?.split(';').slice(6, 8)).toEqual(['1', '1t']);
    // les autres accords n'ont pas bougé
    for (const n of [0, 2, 3]) expect(await nombreAllume(page, n)).toBe(24);
    expect(garde.bloquees).toEqual([]);
  });

  test('on peut poser une note sur chacune des trois voix et des huit croches', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    for (const [v, k] of [[0, 0], [1, 3], [2, 7]]) await cellule(page, 1, v, k).click();
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['0.0:normal', '1.3:normal', '2.7:normal']);
  });

  test('tirer la poignée de droite étire la note @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 2).click();
    await expect.poll(() => croches(page, 1, 1)).toEqual([2]);
    await etirerVers(page, poigneeDroite(cellule(page, 1, 1, 2)), cellule(page, 1, 1, 5));
    await expect.poll(() => croches(page, 1, 1)).toEqual([2, 3, 4, 5]);
    // une seule note longue, pas quatre : une poignée de gauche (au début) et une poignée de droite (à la fin)
    await expect(grille(page).locator('.sq-case[data-c="1"][data-v="1"] .sq-bord.g')).toHaveCount(1);
    await expect(grille(page).locator('.sq-case[data-c="1"][data-v="1"] .sq-bord.d')).toHaveCount(1);
    await expect.poll(async () => (await motifStocke(page, 0, 1)).arpPattern?.split(';').slice(4, 12)).toEqual(['1', '1t', '1t', '1t', '1t', '1t', '1t', '1t']);
  });

  test('tirer la poignée de droite vers la gauche raccourcit la note', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 2).click();
    await etirerVers(page, poigneeDroite(cellule(page, 1, 1, 2)), cellule(page, 1, 1, 5));
    await expect.poll(() => croches(page, 1, 1)).toEqual([2, 3, 4, 5]);
    await etirerVers(page, poigneeDroite(cellule(page, 1, 1, 5)), cellule(page, 1, 1, 3));   // la poignée de droite est dans la dernière case de la note
    await expect.poll(() => croches(page, 1, 1)).toEqual([2, 3]);
  });

  test('tirer la poignée de gauche étire la note vers le début', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 4).click();
    await expect.poll(() => croches(page, 1, 1)).toEqual([4]);
    await etirerVers(page, poigneeGauche(cellule(page, 1, 1, 4)), cellule(page, 1, 1, 2));
    await expect.poll(() => croches(page, 1, 1)).toEqual([2, 3, 4]);
  });

  test('une note étirée sur toute la mesure couvre les huit croches', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 0, 0).click();
    await etirerVers(page, poigneeDroite(cellule(page, 1, 0, 0)), cellule(page, 1, 0, 7));
    await expect.poll(() => croches(page, 1, 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // elle ne déborde pas sur l'accord suivant
    expect(await nombreAllume(page, 2)).toBe(24);
    await expect(grille(page).locator('.sq-case[data-c="2"][data-v="0"].on')).toHaveCount(8);
  });

  test('glisser la note la déplace dans le temps @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 0, 1).click();
    await expect.poll(() => croches(page, 1, 0)).toEqual([1]);
    await deplacerVers(page, cellule(page, 1, 0, 1), cellule(page, 1, 0, 5));
    await expect.poll(() => croches(page, 1, 0)).toEqual([5]);
    expect(await notesAllumees(page, 1)).toEqual(['0.5:normal']);
  });

  test('glisser la note vers une autre ligne change sa voix, et le nom qu\'elle porte', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 0, 3).click();
    await expect(noteDe(cellule(page, 1, 0, 3))).toHaveText('A3');
    await deplacerVers(page, cellule(page, 1, 0, 3), cellule(page, 1, 2, 3));
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['2.3:normal']);
    await expect(noteDe(cellule(page, 1, 2, 3))).toHaveText('E4');
  });

  test('une note étirée se déplace d\'un bloc', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 1).click();
    await etirerVers(page, poigneeDroite(cellule(page, 1, 1, 1)), cellule(page, 1, 1, 3));
    await expect.poll(() => croches(page, 1, 1)).toEqual([1, 2, 3]);
    await deplacerVers(page, cellule(page, 1, 1, 2), cellule(page, 1, 1, 5));   // saisie au milieu (croche 3), déposée croche 6 : +3
    await expect.poll(() => croches(page, 1, 1)).toEqual([4, 5, 6]);
  });

  test('un clic sur une note la sélectionne sans la supprimer ; un clic sur une autre note déplace la sélection', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 2).click();
    await cellule(page, 1, 2, 5).click();   // la première a posé la note, la seconde en pose une autre
    await expect.poll(() => nombreAllume(page, 1)).toBe(2);
    await cellule(page, 1, 1, 2).click();
    await expect(cellule(page, 1, 1, 2)).toHaveClass(/\bsq-sel\b/);
    expect(await nombreAllume(page, 1)).toBe(2);
    await cellule(page, 1, 2, 5).click();
    await expect(cellule(page, 1, 2, 5)).toHaveClass(/\bsq-sel\b/);
    await expect(cellule(page, 1, 1, 2)).not.toHaveClass(/\bsq-sel\b/);
    expect(await nombreAllume(page, 1)).toBe(2);
  });

  test('Suppr supprime la note sélectionnée, et elle seule @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 0, 1).click();
    await cellule(page, 1, 2, 5).click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(2);
    await cellule(page, 1, 0, 1).click();   // sélectionne la note de la voix grave
    await expect(cellule(page, 1, 0, 1)).toHaveClass(/\bsq-sel\b/);
    await page.keyboard.press('Delete');
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['2.5:normal']);
    expect((await motifStocke(page, 0, 1)).arpPattern?.split(';')[2]).toBe('');   // la croche supprimée n'est plus enregistrée
  });

  test('Retour arrière supprime aussi la note sélectionnée', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 4).click();
    await cellule(page, 1, 1, 4).click();
    await expect(cellule(page, 1, 1, 4)).toHaveClass(/\bsq-sel\b/);
    await page.keyboard.press('Backspace');
    await expect.poll(() => nombreAllume(page, 1)).toBe(0);
  });

  test('Ctrl + clic ajoute des notes à la sélection, Suppr les supprime ensemble', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    for (const [v, k] of [[0, 0], [1, 3], [2, 6]]) await cellule(page, 1, v, k).click();
    await cellule(page, 1, 0, 0).click();
    await cellule(page, 1, 1, 3).click({ modifiers: ['Control'] });
    await expect(cellule(page, 1, 0, 0)).toHaveClass(/\bsq-sel\b/);
    await expect(cellule(page, 1, 1, 3)).toHaveClass(/\bsq-sel\b/);
    await expect(cellule(page, 1, 2, 6)).not.toHaveClass(/\bsq-sel\b/);
    await page.keyboard.press('Delete');
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['2.6:normal']);
  });

  // S-03 (bugs.md) : le séquenceur ouvert, appuyer sur Suppr SANS note sélectionnée supprime l'ACCORD choisi de la grille (sans confirmation), alors
  // qu'on s'attend à ne rien supprimer (la touche sert à supprimer des notes). À arbitrer : le comportement vient peut-être de la grille d'accords.
  test('Suppr sans note sélectionnée ne supprime pas l\'accord', async ({ ouvrirAppli }) => {
    test.fail(true, 'S-03 (bugs.md) : bug connu (à arbitrer), le test doit repasser au vert quand il sera corrigé');
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
    await page.keyboard.press('Delete');
    await expect(page.locator('#progression-sections .grid-cell[data-index]')).toHaveCount(4, { timeout: 2_000 });
    expect(await nombreAllume(page, 1)).toBe(8);
  });

  test('Ctrl+Z annule la dernière note posée, Ctrl+Maj+Z la rétablit @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 2).click();
    await cellule(page, 1, 2, 5).click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(2);
    await page.keyboard.press('Control+z');
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['1.2:normal']);
    await page.keyboard.press('Control+Shift+z');
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['1.2:normal', '2.5:normal']);
  });

  test('Ctrl+Z annule aussi un étirement et un déplacement', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    await cellule(page, 1, 1, 1).click();
    await etirerVers(page, poigneeDroite(cellule(page, 1, 1, 1)), cellule(page, 1, 1, 3));
    await expect.poll(() => croches(page, 1, 1)).toEqual([1, 2, 3]);
    await deplacerVers(page, cellule(page, 1, 1, 1), cellule(page, 1, 2, 1));
    await expect.poll(() => croches(page, 1, 2)).toEqual([1, 2, 3]);
    await page.keyboard.press('Control+z');
    await expect.poll(() => croches(page, 1, 1)).toEqual([1, 2, 3]);
    await page.keyboard.press('Control+z');
    await expect.poll(() => croches(page, 1, 1)).toEqual([1]);
  });

  test('glisser sur des cases vides peint une seule note tenue', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    const a = (await cellule(page, 1, 1, 1).boundingBox())!, b = (await cellule(page, 1, 1, 4).boundingBox())!;
    await glisser(page, { x: a.x + a.width / 2, y: a.y + a.height / 2 }, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    await expect.poll(() => croches(page, 1, 1)).toEqual([1, 2, 3, 4]);   // de la croche d'appui à la croche de relâchement, comprises
    await expect(grille(page).locator('.sq-case[data-c="1"][data-v="1"] .sq-bord.g')).toHaveCount(1);   // une seule note : un seul début
    expect(await nombreAllume(page, 1)).toBe(4);   // rien sur les autres voix
  });

  test('les notes posées sont retrouvées après un rechargement @critique', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    repondreAuxConfirmations(page);
    await accordVide(page);
    await cellule(page, 1, 1, 2).click();
    await etirerVers(page, poigneeDroite(cellule(page, 1, 1, 2)), cellule(page, 1, 1, 4));
    await cellule(page, 1, 0, 6).click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(4);
    await page.reload();
    await expect(sequenceur(page)).toBeVisible();
    await expect.poll(() => notesAllumees(page, 1)).toEqual(['0.6:normal', '1.2:normal', '1.3:normal', '1.4:normal']);
    for (const n of [0, 2, 3]) expect(await nombreAllume(page, n)).toBe(24);
  });

  test('retoucher un rythme prédéfini garde ses autres notes', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await rythme(page, 'pompe').click();
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
    await cellule(page, 1, 2, 4).click();   // une note de plus sur la voix aiguë, case vide de « Pompe »
    await expect.poll(() => nombreAllume(page, 1)).toBe(9);
    await cellule(page, 1, 1, 2).click();   // sélectionne une note de l'accord de « Pompe »
    await page.keyboard.press('Delete');
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
    expect(await croches(page, 1, 0)).toEqual([0, 1, 4, 5]);   // la basse n'a pas bougé
    expect(await croches(page, 1, 1)).toEqual([6]);
  });
});

test.describe('Notes — téléphone @sequenceur @mobile', () => {
  test('un toucher pose une croche sur une case vide, un second toucher l\'enlève @critique', async ({ ouvrirAppli, garde }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await accordVide(page);
    const c = cellule(page, 1, 1, 3);
    await toucher(page, c);
    await attendreNiveau(c, 'normal');
    expect(await notesAllumees(page, 1)).toEqual(['1.3:normal']);
    await expect(noteDe(c)).toHaveText('C4');
    await expect.poll(async () => (await motifStocke(page, 0, 1)).arpPattern?.split(';').slice(6, 8)).toEqual(['1', '1t']);
    await toucher(page, c);
    await attendreNiveau(c, 'vide');
    expect(await nombreAllume(page, 1)).toBe(0);
    expect(garde.bloquees).toEqual([]);
  });

  test('toucher une note d\'un rythme prédéfini l\'enlève et le rythme passe en « rythme libre »', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    await page.locator('#sq-portee-accord').tap();
    await rythme(page, 'pompe').tap();
    await expect.poll(() => nombreAllume(page, 1)).toBe(8);
    await toucher(page, cellule(page, 1, 1, 2));   // la note de l'accord, croche 3 (une croche)
    await expect.poll(() => nombreAllume(page, 1)).toBe(7);
    await expect(rythme(page, 'pompe')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#sq-motif-main')).toHaveAttribute('aria-pressed', 'true');
  });

  test('« Dessiner » s\'allume et s\'éteint ; allumé, la grille ne défile plus', async ({ ouvrirAppli }) => {
    const page = await ouvrirAppli({ accords: C_AM_F_G });
    await ouvrirSurAccord(page, 1);
    const dessin = page.locator('#sq-dessin');
    await expect(dessin).toHaveAttribute('aria-pressed', 'false');
    await dessin.tap();
    await expect(dessin).toHaveAttribute('aria-pressed', 'true');
    await expect(dessin).toHaveAttribute('title', /Dessiner allumé/);
    await dessin.tap();
    await expect(dessin).toHaveAttribute('aria-pressed', 'false');
  });
});
